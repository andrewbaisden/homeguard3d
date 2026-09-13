"use server";

import { ROOM_KINDS } from "@/lib/constants";
import { requireAccess } from "@/server/authz";
import { prisma } from "@homeguard/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * Structural edits (floors/rooms/doors/windows) require ADMIN or
 * higher — VIEWER/MEMBER can see the property but not reshape it. See
 * ARCHITECTURE.md section R.
 */
const STRUCTURAL_MIN_ROLE = "ADMIN" as const;

function rectanglePolygon(x: number, y: number, width: number, height: number) {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

const wallOffsetSchema = z.object({
  wallSegmentIndex: z.coerce.number().int().min(0).max(3),
  offsetMeters: z.coerce.number().min(0).max(200),
  widthMeters: z.coerce.number().positive().max(10),
});

const createFloorSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  level: z.coerce.number().int().min(-5).max(50),
});

export async function createFloor(
  propertyId: string,
  input: z.infer<typeof createFloorSchema>,
): Promise<void> {
  await requireAccess(propertyId, STRUCTURAL_MIN_ROLE);
  const data = createFloorSchema.parse(input);

  await prisma.floor.create({
    data: { propertyId, name: data.name, level: data.level },
  });

  revalidatePath(`/properties/${propertyId}`);
}

const createRoomSchema = z.object({
  floorId: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(80),
  kind: z.enum(ROOM_KINDS),
  x: z.coerce.number().min(-1000).max(1000),
  y: z.coerce.number().min(-1000).max(1000),
  width: z.coerce.number().positive().max(100),
  height: z.coerce.number().positive().max(100),
});

export async function createRoom(
  propertyId: string,
  input: z.infer<typeof createRoomSchema>,
): Promise<void> {
  await requireAccess(propertyId, STRUCTURAL_MIN_ROLE);
  const data = createRoomSchema.parse(input);

  // Guard against a floorId from another property being submitted.
  const floor = await prisma.floor.findFirst({
    where: { id: data.floorId, propertyId },
    select: { id: true },
  });
  if (!floor) {
    throw new Error("Floor not found on this property.");
  }

  await prisma.room.create({
    data: {
      floorId: data.floorId,
      name: data.name,
      kind: data.kind,
      polygon: rectanglePolygon(data.x, data.y, data.width, data.height),
    },
  });

  revalidatePath(`/properties/${propertyId}`);
}

const createDoorSchema = wallOffsetSchema.extend({
  roomId: z.string().min(1),
  isExterior: z.coerce.boolean(),
});

export async function createDoor(
  propertyId: string,
  input: z.infer<typeof createDoorSchema>,
): Promise<void> {
  await requireAccess(propertyId, STRUCTURAL_MIN_ROLE);
  const data = createDoorSchema.parse(input);

  const room = await prisma.room.findFirst({
    where: { id: data.roomId, floor: { propertyId } },
    select: { id: true },
  });
  if (!room) {
    throw new Error("Room not found on this property.");
  }

  await prisma.door.create({
    data: {
      roomId: data.roomId,
      isExterior: data.isExterior,
      wallOffset: {
        wallSegmentIndex: data.wallSegmentIndex,
        offsetMeters: data.offsetMeters,
        widthMeters: data.widthMeters,
      },
    },
  });

  revalidatePath(`/properties/${propertyId}`);
}

const createWindowSchema = wallOffsetSchema.extend({
  roomId: z.string().min(1),
});

export async function createWindow(
  propertyId: string,
  input: z.infer<typeof createWindowSchema>,
): Promise<void> {
  await requireAccess(propertyId, STRUCTURAL_MIN_ROLE);
  const data = createWindowSchema.parse(input);

  const room = await prisma.room.findFirst({
    where: { id: data.roomId, floor: { propertyId } },
    select: { id: true },
  });
  if (!room) {
    throw new Error("Room not found on this property.");
  }

  await prisma.window.create({
    data: {
      roomId: data.roomId,
      wallOffset: {
        wallSegmentIndex: data.wallSegmentIndex,
        offsetMeters: data.offsetMeters,
        widthMeters: data.widthMeters,
      },
    },
  });

  revalidatePath(`/properties/${propertyId}`);
}
