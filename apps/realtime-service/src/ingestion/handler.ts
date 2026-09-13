import { randomUUID } from "node:crypto";
import { Prisma, prisma } from "@homeguard/database";
import {
  type AutomationEvaluationState,
  type AutomationJobDescriptor,
  type DeviceStateEvent,
  type DomainEvent,
  type SecurityDomainEvent,
  type SecurityEffect,
  automationRuleDefinitionSchema,
  domainEventSchema,
  evaluateAlertRules,
  evaluateAutomationRules,
  isDeviceStateEvent,
  mapToSecurityDomainEvent,
  reduceDeviceEvent,
  transition,
} from "@homeguard/domain";
import type { Queue } from "bullmq";
import { enqueueAutomationJobs } from "../jobs/automation-worker";
import type { RealtimeBus } from "../realtime/pubsub";
import { type ReIngestSyntheticEvent, scheduleSecurityEffects } from "../security/timers";
import {
  getHotZoneIds,
  getOpenDeviceIdsInZones,
  isDeviceInZones,
  isEntryPointDevice,
} from "../security/zones";

export class IngestionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IngestionValidationError";
  }
}

export type IngestStatus = "applied" | "duplicate" | "stale" | "rejected";

export interface IngestResult {
  status: IngestStatus;
  eventId: string;
  propertyId: string;
  rejectedReason?: string;
  rejectedDeviceIds?: string[];
}

interface TxOutcome {
  status: IngestStatus;
  rejectedReason?: string;
  rejectedDeviceIds?: string[];
  publishEvents: DomainEvent[];
  effects: SecurityEffect[];
  automationJobs: AutomationJobDescriptor[];
}

type Tx = Prisma.TransactionClient;

let automationQueue: Queue<AutomationJobDescriptor> | undefined;

export function setAutomationQueue(queue: Queue<AutomationJobDescriptor> | undefined): void {
  automationQueue = queue;
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function toEventRow(event: DomainEvent) {
  return {
    eventId: event.eventId,
    propertyId: event.propertyId,
    deviceId: "deviceId" in event ? event.deviceId : null,
    roomId: event.roomId ?? null,
    entityId: event.entityId ?? null,
    type: event.type,
    source: event.source,
    sequence: event.sequence != null ? BigInt(event.sequence) : null,
    occurredAt: new Date(event.occurredAt),
    metadata: event.metadata,
  };
}

function emptyOutcome(status: IngestStatus): TxOutcome {
  return { status, publishEvents: [], effects: [], automationJobs: [] };
}

async function loadEvaluationState(tx: Tx, propertyId: string): Promise<AutomationEvaluationState> {
  const [security, devices] = await Promise.all([
    tx.securityState.findUnique({ where: { propertyId } }),
    tx.device.findMany({
      where: { propertyId },
      select: { id: true, connectivity: true, doorState: true },
    }),
  ]);
  return {
    security: {
      machineState: security?.machineState ?? "IDLE_DISARMED",
      mode: security?.mode ?? "DISARMED",
    },
    devices: Object.fromEntries(
      devices.map((device) => [
        device.id,
        {
          connectivity: device.connectivity,
          doorState: device.doorState,
        },
      ]),
    ),
  };
}

async function applyAlertAndAutomationEffects(
  tx: Tx,
  event: DomainEvent,
  previous: AutomationEvaluationState,
  publishEvents: DomainEvent[],
): Promise<AutomationJobDescriptor[]> {
  // Alert lifecycle events must not re-enter evaluation (avoid loops).
  if (
    event.type === "alert.raised" ||
    event.type === "alert.acknowledged" ||
    event.type === "alert.resolved"
  ) {
    return [];
  }

  const next = await loadEvaluationState(tx, event.propertyId);
  const proposals = evaluateAlertRules(event, previous, next);
  for (const proposal of proposals) {
    const alertId = randomUUID();
    await tx.alert.create({
      data: {
        id: alertId,
        propertyId: event.propertyId,
        severity: proposal.severity,
        status: "OPEN",
        title: proposal.title,
        triggerEventId: event.eventId,
        deviceId: proposal.deviceId ?? null,
        roomId: proposal.roomId ?? null,
      },
    });
    const raised: DomainEvent = {
      eventId: `${event.eventId}:alert:${alertId}`,
      propertyId: event.propertyId,
      source: event.source === "SIMULATION" ? "SIMULATION" : "SYSTEM",
      occurredAt: new Date().toISOString(),
      type: "alert.raised",
      metadata: {
        alertId,
        severity: proposal.severity,
        title: proposal.title,
      },
    };
    await tx.event.create({ data: toEventRow(raised) });
    publishEvents.push(raised);
  }

  const rules = await tx.automationRule.findMany({
    where: { propertyId: event.propertyId, enabled: true },
  });
  const parsedRules = rules.flatMap((rule) => {
    const definition = automationRuleDefinitionSchema.safeParse(rule.definition);
    if (!definition.success) return [];
    return [
      {
        id: rule.id,
        name: rule.name,
        enabled: rule.enabled,
        definition: definition.data,
      },
    ];
  });

  return evaluateAutomationRules(event, previous, next, parsedRules);
}

/**
 * The synchronous ingestion path — see ARCHITECTURE.md section H.
 * Validate -> one transaction (idempotent Event insert + reducer +
 * state patch + alert evaluation) -> commit -> publish -> schedule
 * timers / enqueue automation actions.
 */
export async function ingestEvent(input: unknown, bus: RealtimeBus): Promise<IngestResult> {
  const parsed = domainEventSchema.safeParse(input);
  if (!parsed.success) {
    throw new IngestionValidationError(parsed.error.message);
  }
  const event: DomainEvent = parsed.data;

  const outcome = await prisma.$transaction(async (tx) => {
    if (isDeviceStateEvent(event)) {
      return applyDeviceEvent(tx, event);
    }

    const securityEvent = mapToSecurityDomainEvent(event);
    if (securityEvent) {
      return applySecurityEvent(tx, event, securityEvent);
    }

    if (
      event.type === "alert.raised" ||
      event.type === "alert.acknowledged" ||
      event.type === "alert.resolved"
    ) {
      return applyAlertLifecycleEvent(tx, event);
    }

    throw new IngestionValidationError(`No ingestion handler for event type "${event.type}"`);
  });

  for (const toPublish of outcome.publishEvents) {
    await bus.publish(toPublish.propertyId, toPublish);
  }

  const reIngest: ReIngestSyntheticEvent = (synthetic) => {
    void ingestEvent(synthetic, bus).catch((error) => {
      console.error("[security-timer] failed to ingest synthetic event", synthetic.type, error);
    });
  };
  scheduleSecurityEffects(event.propertyId, outcome.effects, reIngest);

  if (automationQueue && outcome.automationJobs.length > 0) {
    await enqueueAutomationJobs(automationQueue, outcome.automationJobs).catch((error) => {
      console.error("[automation] failed to enqueue jobs", error);
    });
  }

  return {
    status: outcome.status,
    eventId: event.eventId,
    propertyId: event.propertyId,
    ...(outcome.rejectedReason ? { rejectedReason: outcome.rejectedReason } : {}),
    ...(outcome.rejectedDeviceIds ? { rejectedDeviceIds: outcome.rejectedDeviceIds } : {}),
  };
}

async function applyAlertLifecycleEvent(tx: Tx, event: DomainEvent): Promise<TxOutcome> {
  if (
    event.type !== "alert.raised" &&
    event.type !== "alert.acknowledged" &&
    event.type !== "alert.resolved"
  ) {
    throw new IngestionValidationError(`Not an alert lifecycle event: ${event.type}`);
  }

  try {
    await tx.event.create({ data: toEventRow(event) });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      return emptyOutcome("duplicate");
    }
    throw error;
  }

  if (event.type === "alert.raised") {
    const existing = await tx.alert.findUnique({ where: { id: event.metadata.alertId } });
    if (!existing) {
      await tx.alert.create({
        data: {
          id: event.metadata.alertId,
          propertyId: event.propertyId,
          severity: event.metadata.severity,
          status: "OPEN",
          title: event.metadata.title,
          triggerEventId: event.eventId,
        },
      });
    }
    return { status: "applied", publishEvents: [event], effects: [], automationJobs: [] };
  }

  const alert = await tx.alert.findFirst({
    where: { id: event.metadata.alertId, propertyId: event.propertyId },
  });
  if (!alert) {
    throw new IngestionValidationError(`Alert ${event.metadata.alertId} not found`);
  }

  if (event.type === "alert.acknowledged") {
    await tx.alert.update({
      where: { id: alert.id },
      data: {
        status: "ACKNOWLEDGED",
        acknowledgedAt: new Date(),
        acknowledgedById: event.entityId ?? null,
      },
    });
  } else {
    await tx.alert.update({
      where: { id: alert.id },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        acknowledgedById: alert.acknowledgedById ?? event.entityId ?? null,
      },
    });
  }

  return { status: "applied", publishEvents: [event], effects: [], automationJobs: [] };
}

async function applyDeviceEvent(tx: Tx, event: DeviceStateEvent): Promise<TxOutcome> {
  const device = await tx.device.findUnique({
    where: { id: event.deviceId },
    select: { propertyId: true, lastAppliedSequence: true },
  });
  if (!device) {
    throw new IngestionValidationError(`Device ${event.deviceId} not found`);
  }
  if (device.propertyId !== event.propertyId) {
    throw new IngestionValidationError(
      `Device ${event.deviceId} does not belong to property ${event.propertyId}`,
    );
  }

  const previous = await loadEvaluationState(tx, event.propertyId);

  try {
    await tx.event.create({ data: toEventRow(event) });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      return emptyOutcome("duplicate");
    }
    throw error;
  }

  const incomingSequence = event.sequence != null ? BigInt(event.sequence) : null;
  const isStale =
    incomingSequence != null &&
    device.lastAppliedSequence != null &&
    incomingSequence <= device.lastAppliedSequence;
  if (isStale) {
    return emptyOutcome("stale");
  }

  const patch = reduceDeviceEvent(event);
  await tx.device.update({
    where: { id: event.deviceId },
    data: {
      ...patch,
      stateUpdatedAt: new Date(),
      ...(incomingSequence != null ? { lastAppliedSequence: incomingSequence } : {}),
    },
  });

  const publishEvents: DomainEvent[] = [event];
  let effects: SecurityEffect[] = [];

  const isTriggerCandidate = event.type === "door.opened" || event.type === "motion.started";
  if (isTriggerCandidate) {
    const securityState = await tx.securityState.findUnique({
      where: { propertyId: event.propertyId },
    });
    if (securityState?.machineState === "ARMED") {
      const hotZoneIds = await getHotZoneIds(tx, event.propertyId, securityState.mode);
      const triggeredInHotZone = await isDeviceInZones(tx, event.deviceId, hotZoneIds);

      if (triggeredInHotZone) {
        const isEntryPoint = await isEntryPointDevice(tx, event.deviceId);

        const triggerEvent: DomainEvent = {
          eventId: `${event.eventId}:sensor-triggered`,
          propertyId: event.propertyId,
          deviceId: event.deviceId,
          source: event.source === "SIMULATION" ? "SIMULATION" : "SYSTEM",
          occurredAt: new Date().toISOString(),
          type: "security.sensor_triggered",
          metadata: { isEntryPoint },
        };
        await tx.event.create({ data: toEventRow(triggerEvent) });
        publishEvents.push(triggerEvent);

        const result = transition(
          { machineState: securityState.machineState, mode: securityState.mode },
          { type: "sensor.triggered", deviceId: event.deviceId, isEntryPoint },
        );
        await tx.securityState.update({
          where: { propertyId: event.propertyId },
          data: {
            machineState: result.next.machineState,
            mode: result.next.mode,
            changedAt: new Date(),
          },
        });
        effects = result.effects;
      }
    }
  }

  const automationJobs = await applyAlertAndAutomationEffects(tx, event, previous, publishEvents);
  return { status: "applied", publishEvents, effects, automationJobs };
}

async function applySecurityEvent(
  tx: Tx,
  event: DomainEvent,
  securityEvent: SecurityDomainEvent,
): Promise<TxOutcome> {
  if ("deviceId" in event) {
    const device = await tx.device.findFirst({
      where: { id: event.deviceId, propertyId: event.propertyId },
      select: { id: true },
    });
    if (!device) {
      throw new IngestionValidationError(
        `Device ${event.deviceId} does not belong to property ${event.propertyId}`,
      );
    }
  }

  const previous = await loadEvaluationState(tx, event.propertyId);

  const securityState = await tx.securityState.findUnique({
    where: { propertyId: event.propertyId },
  });
  if (!securityState) {
    throw new IngestionValidationError(`SecurityState not found for property ${event.propertyId}`);
  }

  let input = securityEvent;
  if (securityEvent.type === "arm.requested") {
    const hotZoneIds = await getHotZoneIds(tx, event.propertyId, securityEvent.mode);
    const openHotZoneDeviceIds = await getOpenDeviceIdsInZones(tx, event.propertyId, hotZoneIds);
    input = { ...securityEvent, openHotZoneDeviceIds };
  }

  const result = transition(
    { machineState: securityState.machineState, mode: securityState.mode },
    input,
  );

  if (result.rejected) {
    return {
      status: "rejected",
      rejectedReason: result.rejected.reason,
      rejectedDeviceIds: result.rejected.deviceIds,
      publishEvents: [],
      effects: [],
      automationJobs: [],
    };
  }

  try {
    await tx.event.create({ data: toEventRow(event) });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      return emptyOutcome("duplicate");
    }
    throw error;
  }

  await tx.securityState.update({
    where: { propertyId: event.propertyId },
    data: {
      machineState: result.next.machineState,
      mode: result.next.mode,
      changedAt: new Date(),
      armedById: event.entityId ?? null,
    },
  });

  const publishEvents: DomainEvent[] = [event];
  const automationJobs = await applyAlertAndAutomationEffects(tx, event, previous, publishEvents);
  return { status: "applied", publishEvents, effects: result.effects, automationJobs };
}
