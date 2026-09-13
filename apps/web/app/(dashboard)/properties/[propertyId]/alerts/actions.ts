"use server";

import { randomUUID } from "node:crypto";
import { IngestRequestError, postEvent } from "@/lib/ingest";
import { getCurrentUserId } from "@/lib/session";
import { requireAccess } from "@/server/authz";
import { prisma } from "@homeguard/database";
import { revalidatePath } from "next/cache";

const ALERT_MIN_ROLE = "MEMBER" as const;

export async function acknowledgeAlert(propertyId: string, alertId: string): Promise<void> {
  await requireAccess(propertyId, ALERT_MIN_ROLE);
  const userId = await getCurrentUserId();
  const alert = await prisma.alert.findFirst({
    where: { id: alertId, propertyId },
    select: { id: true, status: true },
  });
  if (!alert) throw new Error("Alert not found.");
  if (alert.status === "RESOLVED") throw new Error("Alert is already resolved.");

  try {
    await postEvent({
      eventId: randomUUID(),
      propertyId,
      entityId: userId ?? undefined,
      source: "USER",
      occurredAt: new Date().toISOString(),
      type: "alert.acknowledged",
      metadata: { alertId },
    });
  } catch (error) {
    throw error instanceof IngestRequestError
      ? error
      : new Error("Failed to reach the realtime service.");
  }

  revalidatePath(`/properties/${propertyId}/alerts`);
}

export async function resolveAlert(propertyId: string, alertId: string): Promise<void> {
  await requireAccess(propertyId, ALERT_MIN_ROLE);
  const userId = await getCurrentUserId();
  const alert = await prisma.alert.findFirst({
    where: { id: alertId, propertyId },
    select: { id: true },
  });
  if (!alert) throw new Error("Alert not found.");

  try {
    await postEvent({
      eventId: randomUUID(),
      propertyId,
      entityId: userId ?? undefined,
      source: "USER",
      occurredAt: new Date().toISOString(),
      type: "alert.resolved",
      metadata: { alertId },
    });
  } catch (error) {
    throw error instanceof IngestRequestError
      ? error
      : new Error("Failed to reach the realtime service.");
  }

  revalidatePath(`/properties/${propertyId}/alerts`);
}
