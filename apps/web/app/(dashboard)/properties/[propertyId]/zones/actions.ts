"use server";

import { requireAccess } from "@/server/authz";
import { prisma } from "@homeguard/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/** Structural edits require ADMIN+ — see ARCHITECTURE.md section R. */
const STRUCTURAL_MIN_ROLE = "ADMIN" as const;

const securityModes = ["HOME", "NIGHT", "AWAY"] as const;

const createZoneSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  activeModes: z.array(z.enum(securityModes)),
});

export async function createZone(
  propertyId: string,
  input: z.infer<typeof createZoneSchema>,
): Promise<void> {
  await requireAccess(propertyId, STRUCTURAL_MIN_ROLE);
  const data = createZoneSchema.parse(input);

  await prisma.securityZone.create({
    data: {
      propertyId,
      name: data.name,
      modeLinks: { create: data.activeModes.map((mode) => ({ mode })) },
    },
  });

  revalidatePath(`/properties/${propertyId}/zones`);
}

const zoneRoomSchema = z.object({ zoneId: z.string().min(1), roomId: z.string().min(1) });

export async function addRoomToZone(
  propertyId: string,
  input: z.infer<typeof zoneRoomSchema>,
): Promise<void> {
  await requireAccess(propertyId, STRUCTURAL_MIN_ROLE);
  const data = zoneRoomSchema.parse(input);

  const [zone, room] = await Promise.all([
    prisma.securityZone.findFirst({ where: { id: data.zoneId, propertyId }, select: { id: true } }),
    prisma.room.findFirst({
      where: { id: data.roomId, floor: { propertyId } },
      select: { id: true },
    }),
  ]);
  if (!zone || !room) {
    throw new Error("Zone or room not found on this property.");
  }

  await prisma.zoneRoom.upsert({
    where: { zoneId_roomId: { zoneId: data.zoneId, roomId: data.roomId } },
    create: { zoneId: data.zoneId, roomId: data.roomId },
    update: {},
  });

  revalidatePath(`/properties/${propertyId}/zones`);
}

export async function removeRoomFromZone(
  propertyId: string,
  input: z.infer<typeof zoneRoomSchema>,
): Promise<void> {
  await requireAccess(propertyId, STRUCTURAL_MIN_ROLE);
  const data = zoneRoomSchema.parse(input);

  await prisma.zoneRoom.deleteMany({
    where: { zoneId: data.zoneId, roomId: data.roomId, zone: { propertyId } },
  });

  revalidatePath(`/properties/${propertyId}/zones`);
}
