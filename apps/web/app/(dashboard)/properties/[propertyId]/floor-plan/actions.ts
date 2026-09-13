"use server";

import { requireAccess } from "@/server/authz";
import { prisma } from "@homeguard/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/** Structural edits require ADMIN+ — see ARCHITECTURE.md section R. */
const STRUCTURAL_MIN_ROLE = "ADMIN" as const;

const setDevicePositionSchema = z.object({
  deviceId: z.string().min(1),
  x: z.coerce.number().min(-1000).max(1000),
  y: z.coerce.number().min(-1000).max(1000),
});

export async function setDevicePosition(
  propertyId: string,
  input: z.infer<typeof setDevicePositionSchema>,
): Promise<void> {
  await requireAccess(propertyId, STRUCTURAL_MIN_ROLE);
  const data = setDevicePositionSchema.parse(input);

  const device = await prisma.device.findFirst({
    where: { id: data.deviceId, propertyId },
    select: { id: true },
  });
  if (!device) {
    throw new Error("Device not found on this property.");
  }

  await prisma.device.update({
    where: { id: data.deviceId },
    data: { positionX: data.x, positionY: data.y },
  });

  revalidatePath(`/properties/${propertyId}/floor-plan`);
}
