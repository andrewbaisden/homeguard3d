import type { Prisma } from "@homeguard/database";

type Tx = Prisma.TransactionClient;

/** Zone IDs currently "hot" (arm-relevant) for the given mode — see ARCHITECTURE.md section F. */
export async function getHotZoneIds(
  tx: Tx,
  propertyId: string,
  mode: "DISARMED" | "HOME" | "NIGHT" | "AWAY",
): Promise<string[]> {
  const zones = await tx.securityZone.findMany({
    where: { propertyId, modeLinks: { some: { mode } } },
    select: { id: true },
  });
  return zones.map((zone) => zone.id);
}

/** Devices currently OPEN that belong to one of the given zones (directly, or via their room). */
export async function getOpenDeviceIdsInZones(
  tx: Tx,
  propertyId: string,
  zoneIds: string[],
): Promise<string[]> {
  if (zoneIds.length === 0) return [];

  const devices = await tx.device.findMany({
    where: {
      propertyId,
      doorState: "OPEN",
      OR: [
        { zoneLinks: { some: { zoneId: { in: zoneIds } } } },
        { room: { zoneLinks: { some: { zoneId: { in: zoneIds } } } } },
      ],
    },
    select: { id: true },
  });
  return devices.map((device) => device.id);
}

/** Whether a specific device belongs to any of the given zones (directly, or via its room). */
export async function isDeviceInZones(
  tx: Tx,
  deviceId: string,
  zoneIds: string[],
): Promise<boolean> {
  if (zoneIds.length === 0) return false;

  const device = await tx.device.findUnique({
    where: { id: deviceId },
    select: {
      zoneLinks: { select: { zoneId: true } },
      room: { select: { zoneLinks: { select: { zoneId: true } } } },
    },
  });
  if (!device) return false;

  const memberZoneIds = new Set<string>([
    ...device.zoneLinks.map((link) => link.zoneId),
    ...(device.room?.zoneLinks.map((link) => link.zoneId) ?? []),
  ]);
  return zoneIds.some((zoneId) => memberZoneIds.has(zoneId));
}

/**
 * Heuristic for "is this an entry point" (see ARCHITECTURE.md section
 * E): a triggering device linked to an exterior Door gets the entry
 * delay; anything else (motion sensors, interior doors) goes straight
 * to ALERT. The schema has no explicit isEntryPoint concept yet.
 */
export async function isEntryPointDevice(tx: Tx, deviceId: string): Promise<boolean> {
  const door = await tx.door.findUnique({ where: { deviceId }, select: { isExterior: true } });
  return door?.isExterior ?? false;
}
