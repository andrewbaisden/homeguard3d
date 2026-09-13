import { Prisma, prisma } from "@homeguard/database";
import { type DomainEvent, domainEventSchema, reduceDeviceEvent } from "@homeguard/domain";
import type { RealtimeBus } from "../realtime/pubsub";

export class IngestionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IngestionValidationError";
  }
}

export type IngestStatus = "applied" | "duplicate" | "stale";

export interface IngestResult {
  status: IngestStatus;
  eventId: string;
  propertyId: string;
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * The synchronous ingestion path — see ARCHITECTURE.md section H.
 * Validate -> one transaction (idempotent Event insert + reducer +
 * Device patch) -> commit -> publish. This is the ONLY function in the
 * system that writes Device operational-state columns; apps/web never
 * calls Prisma directly for this (see AGENTS.md rule #1 / ADR-005).
 */
export async function ingestEvent(input: unknown, bus: RealtimeBus): Promise<IngestResult> {
  const parsed = domainEventSchema.safeParse(input);
  if (!parsed.success) {
    throw new IngestionValidationError(parsed.error.message);
  }
  const event: DomainEvent = parsed.data;

  const status = await prisma.$transaction(async (tx) => {
    try {
      await tx.event.create({
        data: {
          eventId: event.eventId,
          propertyId: event.propertyId,
          deviceId: event.deviceId,
          roomId: event.roomId ?? null,
          entityId: event.entityId ?? null,
          type: event.type,
          source: event.source,
          sequence: event.sequence != null ? BigInt(event.sequence) : null,
          occurredAt: new Date(event.occurredAt),
          metadata: event.metadata,
        },
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        return "duplicate" satisfies IngestStatus;
      }
      throw error;
    }

    const device = await tx.device.findUnique({
      where: { id: event.deviceId },
      select: { lastAppliedSequence: true },
    });
    if (!device) {
      throw new IngestionValidationError(`Device ${event.deviceId} not found`);
    }

    const incomingSequence = event.sequence != null ? BigInt(event.sequence) : null;
    const isStale =
      incomingSequence != null &&
      device.lastAppliedSequence != null &&
      incomingSequence <= device.lastAppliedSequence;
    if (isStale) {
      return "stale" satisfies IngestStatus;
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

    return "applied" satisfies IngestStatus;
  });

  if (status === "applied") {
    await bus.publish(event.propertyId, event);
  }

  return { status, eventId: event.eventId, propertyId: event.propertyId };
}
