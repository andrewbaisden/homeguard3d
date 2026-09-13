"use server";

import { CAPABILITIES, DEVICE_CATEGORIES } from "@/lib/constants";
import { requireAccess } from "@/server/authz";
import { prisma } from "@homeguard/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/** Structural edits require ADMIN+ — see ARCHITECTURE.md section R. */
const STRUCTURAL_MIN_ROLE = "ADMIN" as const;

const createDeviceSchema = z.object({
  category: z.enum(DEVICE_CATEGORIES),
  label: z.string().trim().min(1, "Name is required").max(120),
  provider: z.string().trim().min(1, "Provider is required").max(60),
  roomId: z.string().min(1).optional(),
  capabilities: z.array(z.enum(CAPABILITIES)),
});

export async function createDevice(
  propertyId: string,
  input: z.infer<typeof createDeviceSchema>,
): Promise<void> {
  await requireAccess(propertyId, STRUCTURAL_MIN_ROLE);
  const data = createDeviceSchema.parse(input);

  if (data.roomId) {
    const room = await prisma.room.findFirst({
      where: { id: data.roomId, floor: { propertyId } },
      select: { id: true },
    });
    if (!room) {
      throw new Error("Room not found on this property.");
    }
  }

  await prisma.device.create({
    data: {
      propertyId,
      roomId: data.roomId ?? null,
      category: data.category,
      label: data.label,
      provider: data.provider,
      capabilities: {
        create: data.capabilities.map((capability) => ({ capability })),
      },
    },
  });

  revalidatePath(`/properties/${propertyId}/devices`);
}
