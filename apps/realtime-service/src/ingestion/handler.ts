import { Prisma, prisma } from "@homeguard/database";
import {
  type DeviceStateEvent,
  type DomainEvent,
  type SecurityDomainEvent,
  type SecurityEffect,
  domainEventSchema,
  isDeviceStateEvent,
  mapToSecurityDomainEvent,
  reduceDeviceEvent,
  transition,
} from "@homeguard/domain";
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
}

type Tx = Prisma.TransactionClient;

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

/**
 * The synchronous ingestion path — see ARCHITECTURE.md section H.
 * Validate -> one transaction (idempotent Event insert + reducer +
 * state patch) -> commit -> publish -> schedule any timers. This is
 * the ONLY function in the system that writes Device/SecurityState
 * operational-state columns; apps/web never calls Prisma directly for
 * this (see AGENTS.md rule #1 / ADR-005).
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

  return {
    status: outcome.status,
    eventId: event.eventId,
    propertyId: event.propertyId,
    ...(outcome.rejectedReason ? { rejectedReason: outcome.rejectedReason } : {}),
    ...(outcome.rejectedDeviceIds ? { rejectedDeviceIds: outcome.rejectedDeviceIds } : {}),
  };
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

  try {
    await tx.event.create({ data: toEventRow(event) });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      return { status: "duplicate", publishEvents: [], effects: [] };
    }
    throw error;
  }

  const incomingSequence = event.sequence != null ? BigInt(event.sequence) : null;
  const isStale =
    incomingSequence != null &&
    device.lastAppliedSequence != null &&
    incomingSequence <= device.lastAppliedSequence;
  if (isStale) {
    return { status: "stale", publishEvents: [], effects: [] };
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

  // While ARMED, an opened door/started motion in a hot zone also
  // drives the security state machine — see ARCHITECTURE.md section E
  // ("ARMED --sensor.trigger--> ENTRY_DELAY/ALERT").
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

  return { status: "applied", publishEvents, effects };
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
    // Deliberately not persisted — see packages/domain/src/security/mapEvent.ts's
    // doc comment on why a rejected arm attempt must never become an Event row.
    return {
      status: "rejected",
      rejectedReason: result.rejected.reason,
      rejectedDeviceIds: result.rejected.deviceIds,
      publishEvents: [],
      effects: [],
    };
  }

  try {
    await tx.event.create({ data: toEventRow(event) });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      return { status: "duplicate", publishEvents: [], effects: [] };
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

  return { status: "applied", publishEvents: [event], effects: result.effects };
}
