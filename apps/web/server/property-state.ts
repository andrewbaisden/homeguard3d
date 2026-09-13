import "server-only";

import { fetchOccupancySnapshot } from "@/lib/occupancy";
import { prisma } from "@homeguard/database";
import type { StructuralModel } from "@homeguard/domain";
import type { OperationalSnapshot } from "@homeguard/state";

const deviceOperationalSelect = {
  id: true,
  connectivity: true,
  doorState: true,
  lockState: true,
  motionState: true,
  cameraState: true,
  batteryPct: true,
  tempC: true,
  humidityPct: true,
  stateUpdatedAt: true,
  events: {
    orderBy: { occurredAt: "desc" as const },
    take: 1,
    select: { source: true },
  },
} as const;

export async function loadOperationalSnapshot(propertyId: string): Promise<OperationalSnapshot> {
  const [devices, security, latestSecurityEvent, occupancy] = await Promise.all([
    prisma.device.findMany({ where: { propertyId }, select: deviceOperationalSelect }),
    prisma.securityState.findUnique({ where: { propertyId } }),
    prisma.event.findFirst({
      where: { propertyId, type: { startsWith: "security." } },
      orderBy: { occurredAt: "desc" },
      select: { source: true },
    }),
    fetchOccupancySnapshot(propertyId),
  ]);

  return {
    devices: devices.map((device) => ({
      id: device.id,
      connectivity: device.connectivity,
      doorState: device.doorState,
      lockState: device.lockState,
      motionState: device.motionState,
      cameraState: device.cameraState,
      batteryPct: device.batteryPct,
      tempC: device.tempC,
      humidityPct: device.humidityPct,
      stateUpdatedAt: device.stateUpdatedAt?.toISOString() ?? null,
      source: device.events[0]?.source ?? null,
    })),
    security: {
      machineState: security?.machineState ?? "IDLE_DISARMED",
      mode: security?.mode ?? "DISARMED",
      changedAt: (security?.changedAt ?? new Date(0)).toISOString(),
      source: latestSecurityEvent?.source ?? null,
    },
    occupancy,
  };
}

export async function loadStructuralModel(propertyId: string): Promise<StructuralModel | null> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      name: true,
      floors: {
        orderBy: { level: "asc" },
        select: {
          id: true,
          name: true,
          level: true,
          rooms: {
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              kind: true,
              polygon: true,
              doors: {
                orderBy: { id: "asc" },
                select: { id: true, wallOffset: true, isExterior: true, deviceId: true },
              },
              windows: {
                orderBy: { id: "asc" },
                select: { id: true, wallOffset: true, deviceId: true },
              },
              devices: {
                orderBy: { id: "asc" },
                select: {
                  id: true,
                  label: true,
                  category: true,
                  roomId: true,
                  positionX: true,
                  positionY: true,
                  capabilities: { select: { capability: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!property) return null;

  return {
    propertyId: property.id,
    propertyName: property.name,
    floors: property.floors.map((floor) => ({
      ...floor,
      rooms: floor.rooms.map((room) => ({
        ...room,
        polygon: room.polygon as Array<{ x: number; y: number }>,
        doors: room.doors.map((door) => ({
          ...door,
          wallOffset: door.wallOffset as {
            wallSegmentIndex: number;
            offsetMeters: number;
            widthMeters: number;
          },
        })),
        windows: room.windows.map((window) => ({
          ...window,
          wallOffset: window.wallOffset as {
            wallSegmentIndex: number;
            offsetMeters: number;
            widthMeters: number;
          },
        })),
        devices: room.devices.map((device) => ({
          ...device,
          capabilities: device.capabilities.map((item) => item.capability),
        })),
      })),
    })),
  };
}
