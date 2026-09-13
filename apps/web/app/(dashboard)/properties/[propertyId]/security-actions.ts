"use server";

import { randomUUID } from "node:crypto";
import { IngestRequestError, postEvent } from "@/lib/ingest";
import { getCurrentUserId } from "@/lib/session";
import { requireAccess } from "@/server/authz";
import { prisma } from "@homeguard/database";
import { revalidatePath } from "next/cache";

/**
 * Arm/disarm are sensitive commands — MEMBER+ (not VIEWER). See
 * ARCHITECTURE.md section R. Structural edits (Phase 2's floor/room
 * CRUD) require ADMIN+; this is deliberately a lower bar since any
 * occupant of a property should be able to arm/disarm it.
 */
const SECURITY_MIN_ROLE = "MEMBER" as const;

async function describeBlockedDevices(propertyId: string, deviceIds: string[]): Promise<string> {
  if (deviceIds.length === 0) return "Arming was blocked.";
  const devices = await prisma.device.findMany({
    where: { id: { in: deviceIds }, propertyId },
    select: { label: true },
  });
  const labels = devices.map((device) => device.label);
  return `Arming was blocked — still open: ${labels.join(", ")}.`;
}

export async function armSecurity(
  propertyId: string,
  mode: "HOME" | "NIGHT" | "AWAY",
  override = false,
): Promise<void> {
  await requireAccess(propertyId, SECURITY_MIN_ROLE);
  const userId = await getCurrentUserId();

  let result: Awaited<ReturnType<typeof postEvent>>;
  try {
    result = await postEvent({
      eventId: randomUUID(),
      propertyId,
      entityId: userId ?? undefined,
      source: "USER",
      occurredAt: new Date().toISOString(),
      type: "security.arm_requested",
      metadata: { mode, override },
    });
  } catch (error) {
    throw error instanceof IngestRequestError
      ? error
      : new Error("Failed to reach the realtime service.");
  }

  if (result.status === "rejected") {
    throw new Error(await describeBlockedDevices(propertyId, result.rejectedDeviceIds ?? []));
  }

  revalidatePath(`/properties/${propertyId}`);
}

export async function cancelArm(propertyId: string): Promise<void> {
  await requireAccess(propertyId, SECURITY_MIN_ROLE);
  const userId = await getCurrentUserId();

  await postEvent({
    eventId: randomUUID(),
    propertyId,
    entityId: userId ?? undefined,
    source: "USER",
    occurredAt: new Date().toISOString(),
    type: "security.arm_cancelled",
    metadata: {},
  });

  revalidatePath(`/properties/${propertyId}`);
}

export async function disarmSecurity(propertyId: string): Promise<void> {
  await requireAccess(propertyId, SECURITY_MIN_ROLE);
  const userId = await getCurrentUserId();

  await postEvent({
    eventId: randomUUID(),
    propertyId,
    entityId: userId ?? undefined,
    source: "USER",
    occurredAt: new Date().toISOString(),
    type: "security.disarmed",
    metadata: {},
  });

  revalidatePath(`/properties/${propertyId}`);
}
