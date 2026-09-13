/**
 * Seeds a deterministic E2E property once the local stack is up.
 *
 * Usage (from repo root, with DATABASE_URL set):
 *   pnpm --filter @homeguard/database exec tsx ../../apps/web/e2e/seed.ts
 *
 * Prints E2E_PROPERTY_ID for Playwright env. Auth password must still be
 * created through the Better Auth sign-up UI (or existing account).
 */
import { prisma } from "@homeguard/database";

async function main() {
  const email = process.env.E2E_USER_EMAIL ?? "e2e@homeguard.local";
  const propertyName = process.env.E2E_PROPERTY_NAME ?? "E2E Demo Home";

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: "E2E User",
        emailVerified: true,
      },
    });
  }

  let property = await prisma.property.findFirst({
    where: { name: propertyName, memberships: { some: { userId: user.id } } },
  });
  if (!property) {
    property = await prisma.property.create({
      data: {
        name: propertyName,
        timezone: "UTC",
        memberships: { create: { userId: user.id, role: "OWNER" } },
        securityState: { create: {} },
        floors: {
          create: {
            name: "Ground",
            level: 0,
            rooms: {
              create: {
                name: "Entry",
                kind: "HALLWAY",
                polygon: [
                  { x: 0, y: 0 },
                  { x: 4, y: 0 },
                  { x: 4, y: 3 },
                  { x: 0, y: 3 },
                ],
              },
            },
          },
        },
      },
    });
  }

  const room = await prisma.room.findFirst({
    where: { floor: { propertyId: property.id } },
    orderBy: { name: "asc" },
  });
  if (!room) throw new Error("Seed room missing");

  const ensureDevice = async (
    label: string,
    category: "CONTACT_SENSOR" | "MOTION_SENSOR" | "LOCK" | "HUB",
  ) => {
    const existing = await prisma.device.findFirst({
      where: { propertyId: property.id, label },
    });
    if (existing) return existing;
    return prisma.device.create({
      data: {
        propertyId: property.id,
        roomId: room.id,
        label,
        category,
        provider: "SIMULATION",
      },
    });
  };

  const contact = await ensureDevice("E2E Front Door", "CONTACT_SENSOR");
  await ensureDevice("E2E Hall Motion", "MOTION_SENSOR");
  await ensureDevice("E2E Front Lock", "LOCK");
  await ensureDevice("E2E Hub", "HUB");

  let zone = await prisma.securityZone.findFirst({
    where: { propertyId: property.id, name: "E2E Perimeter" },
  });
  if (!zone) {
    zone = await prisma.securityZone.create({
      data: {
        propertyId: property.id,
        name: "E2E Perimeter",
        modeLinks: {
          create: [{ mode: "AWAY" }, { mode: "NIGHT" }, { mode: "HOME" }],
        },
      },
    });
  }
  await prisma.zoneRoom.upsert({
    where: { zoneId_roomId: { zoneId: zone.id, roomId: room.id } },
    create: { zoneId: zone.id, roomId: room.id },
    update: {},
  });

  const door = await prisma.door.findFirst({ where: { roomId: room.id } });
  if (!door) {
    await prisma.door.create({
      data: {
        roomId: room.id,
        isExterior: true,
        deviceId: contact.id,
        wallOffset: { wallSegmentIndex: 0, offsetMeters: 0.5, widthMeters: 0.9 },
      },
    });
  }

  console.log(`E2E_PROPERTY_ID=${property.id}`);
  console.log(`E2E_USER_EMAIL=${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
