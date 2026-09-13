"use server";

import { requireAccess } from "@/server/authz";
import { prisma } from "@homeguard/database";
import {
  type DomainEvent,
  type ReplayState,
  domainEventSchema,
  replayToTime,
} from "@homeguard/domain";

export interface ReplayResult {
  targetAt: string;
  snapshotTakenAt: string;
  eventCount: number;
  state: ReplayState;
}

function parseReplayState(value: unknown): ReplayState | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (!record.devicesById || !record.security) return null;
  return value as ReplayState;
}

export async function replayPropertyToTime(
  propertyId: string,
  targetAtIso: string,
): Promise<ReplayResult> {
  await requireAccess(propertyId, "VIEWER");
  const targetAt = new Date(targetAtIso);
  if (Number.isNaN(targetAt.getTime())) {
    throw new Error("Invalid target time.");
  }

  const snapshot = await prisma.snapshot.findFirst({
    where: { propertyId, takenAt: { lte: targetAt } },
    orderBy: { takenAt: "desc" },
  });
  if (!snapshot) {
    throw new Error("No snapshot at or before that time. Wait for a snapshot job to run.");
  }

  const base = parseReplayState(snapshot.state);
  if (!base) {
    throw new Error("Stored snapshot is invalid.");
  }

  const rows = await prisma.event.findMany({
    where: {
      propertyId,
      occurredAt: { gt: snapshot.takenAt, lte: targetAt },
    },
    orderBy: { occurredAt: "asc" },
  });

  const events: DomainEvent[] = [];
  for (const row of rows) {
    const parsed = domainEventSchema.safeParse({
      eventId: row.eventId,
      propertyId: row.propertyId,
      deviceId: row.deviceId ?? undefined,
      roomId: row.roomId ?? undefined,
      entityId: row.entityId ?? undefined,
      type: row.type,
      source: row.source,
      sequence: row.sequence != null ? Number(row.sequence) : undefined,
      occurredAt: row.occurredAt.toISOString(),
      metadata: row.metadata,
    });
    if (parsed.success) events.push(parsed.data);
  }

  return {
    targetAt: targetAt.toISOString(),
    snapshotTakenAt: snapshot.takenAt.toISOString(),
    eventCount: events.length,
    state: replayToTime(base, events),
  };
}
