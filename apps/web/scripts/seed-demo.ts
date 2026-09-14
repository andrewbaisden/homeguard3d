/**
 * Seeds a sign-in-ready demo user with a rich 2-floor home.
 *
 * Usage (from repo root, with DATABASE_URL available to Prisma):
 *   pnpm db:seed:demo
 *
 * Optional:
 *   DEMO_EMAIL / DEMO_PASSWORD / DEMO_PROPERTY_NAME
 *   DEMO_RESET=1  — delete the named property for this user and recreate
 *
 * Default credentials:
 *   email:    demo@homeguard.local
 *   password: demopassword123
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Prisma } from "@homeguard/database";

/** Load DATABASE_URL (and friends) when not already present in the process env. */
function loadDatabaseEnv() {
  if (process.env.DATABASE_URL) return;
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, "../../../packages/database/.env"),
    resolve(process.cwd(), "packages/database/.env"),
    resolve(process.cwd(), "../database/.env"),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    process.loadEnvFile(path);
    return;
  }
  throw new Error("DATABASE_URL is unset and packages/database/.env was not found");
}

loadDatabaseEnv();

const DEMO_EMAIL = process.env.DEMO_EMAIL ?? "demo@homeguard.local";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "demopassword123";
const DEMO_NAME = process.env.DEMO_NAME ?? "Demo User";
const PROPERTY_NAME = process.env.DEMO_PROPERTY_NAME ?? "Maple Street Demo";
const TIMEZONE = process.env.DEMO_TIMEZONE ?? "Europe/London";
const RESET = process.env.DEMO_RESET === "1" || process.env.DEMO_RESET === "true";

type RoomKind =
  | "LIVING_ROOM"
  | "KITCHEN"
  | "BEDROOM"
  | "BATHROOM"
  | "OFFICE"
  | "HALLWAY"
  | "GARAGE"
  | "UTILITY"
  | "GARDEN"
  | "OTHER";

type DeviceCategory =
  | "CAMERA"
  | "LOCK"
  | "CONTACT_SENSOR"
  | "MOTION_SENSOR"
  | "ENV_SENSOR"
  | "SIREN"
  | "HUB";

type Capability =
  | "LOCK"
  | "CONTACT"
  | "MOTION"
  | "VIDEO"
  | "AUDIO"
  | "BATTERY"
  | "TEMPERATURE"
  | "HUMIDITY"
  | "SMOKE";

interface RectRoom {
  key: string;
  name: string;
  kind: RoomKind;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DeviceSpec {
  label: string;
  category: DeviceCategory;
  roomKey: string;
  /** Placement inside the room polygon (meters). */
  positionX: number;
  positionY: number;
  capabilities: Capability[];
  doorState?: "OPEN" | "CLOSED" | "UNKNOWN";
  lockState?: "LOCKED" | "UNLOCKED" | "JAMMED" | "UNKNOWN";
  motionState?: "ACTIVE" | "INACTIVE" | "UNKNOWN";
  cameraState?: "ONLINE" | "OFFLINE" | "RECORDING";
  batteryPct?: number;
  tempC?: number;
  humidityPct?: number;
  connectivity?: "ONLINE" | "STALE" | "OFFLINE" | "UNKNOWN";
}

interface OpeningSpec {
  roomKey: string;
  kind: "door" | "window";
  isExterior?: boolean;
  wallSegmentIndex: number;
  offsetMeters: number;
  widthMeters: number;
  /** Device label to link (contact sensor). */
  deviceLabel?: string;
}

function rect(x: number, y: number, width: number, height: number) {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

function center(room: RectRoom): { x: number; y: number } {
  return { x: room.x + room.width / 2, y: room.y + room.height / 2 };
}

/** Ground floor — contiguous footprint roughly 12×7 m. */
const GROUND_ROOMS: RectRoom[] = [
  { key: "g-garage", name: "Garage", kind: "GARAGE", x: 0, y: 0, width: 4, height: 5 },
  { key: "g-hall", name: "Entry Hall", kind: "HALLWAY", x: 4, y: 0, width: 3, height: 3 },
  { key: "g-living", name: "Living Room", kind: "LIVING_ROOM", x: 7, y: 0, width: 5, height: 5 },
  { key: "g-kitchen", name: "Kitchen", kind: "KITCHEN", x: 4, y: 3, width: 3, height: 4 },
  { key: "g-utility", name: "Utility", kind: "UTILITY", x: 7, y: 5, width: 5, height: 2 },
  { key: "g-bath", name: "Guest Bath", kind: "BATHROOM", x: 0, y: 5, width: 4, height: 2 },
];

/** First floor — stacked over the same footprint. */
const FIRST_ROOMS: RectRoom[] = [
  { key: "f-landing", name: "Landing", kind: "HALLWAY", x: 4, y: 0, width: 3, height: 3 },
  { key: "f-master", name: "Master Bedroom", kind: "BEDROOM", x: 7, y: 0, width: 5, height: 5 },
  { key: "f-bed2", name: "Bedroom 2", kind: "BEDROOM", x: 0, y: 0, width: 4, height: 5 },
  { key: "f-bath", name: "Main Bathroom", kind: "BATHROOM", x: 4, y: 3, width: 3, height: 4 },
  { key: "f-bed3", name: "Bedroom 3", kind: "BEDROOM", x: 7, y: 5, width: 5, height: 2 },
  { key: "f-office", name: "Office", kind: "OFFICE", x: 0, y: 5, width: 4, height: 2 },
];

function buildDevices(rooms: RectRoom[]): DeviceSpec[] {
  const byKey = Object.fromEntries(rooms.map((r) => [r.key, r]));
  const at = (key: string, dx = 0, dy = 0) => {
    const room = byKey[key];
    if (!room) throw new Error(`Unknown room key: ${key}`);
    const c = center(room);
    return { positionX: c.x + dx, positionY: c.y + dy };
  };

  return [
    // Ground
    {
      label: "Home Hub",
      category: "HUB",
      roomKey: "g-living",
      ...at("g-living", -1.5, -1.5),
      capabilities: [],
      connectivity: "ONLINE",
    },
    {
      label: "Front Door Contact",
      category: "CONTACT_SENSOR",
      roomKey: "g-hall",
      ...at("g-hall", 0, -1.2),
      capabilities: ["CONTACT", "BATTERY"],
      doorState: "CLOSED",
      batteryPct: 92,
      connectivity: "ONLINE",
    },
    {
      label: "Front Door Lock",
      category: "LOCK",
      roomKey: "g-hall",
      ...at("g-hall", 0.4, -1.2),
      capabilities: ["LOCK", "BATTERY"],
      lockState: "LOCKED",
      batteryPct: 78,
      connectivity: "ONLINE",
    },
    {
      label: "Entry Motion",
      category: "MOTION_SENSOR",
      roomKey: "g-hall",
      ...at("g-hall", 0.8, 0.6),
      capabilities: ["MOTION", "BATTERY"],
      motionState: "INACTIVE",
      batteryPct: 88,
      connectivity: "ONLINE",
    },
    {
      label: "Entry Siren",
      category: "SIREN",
      roomKey: "g-hall",
      ...at("g-hall", -0.8, 0.6),
      capabilities: ["AUDIO", "BATTERY"],
      batteryPct: 100,
      connectivity: "ONLINE",
    },
    {
      label: "Living Motion",
      category: "MOTION_SENSOR",
      roomKey: "g-living",
      ...at("g-living", 1.2, 0.5),
      capabilities: ["MOTION", "BATTERY"],
      motionState: "INACTIVE",
      batteryPct: 85,
      connectivity: "ONLINE",
    },
    {
      label: "Living Climate",
      category: "ENV_SENSOR",
      roomKey: "g-living",
      ...at("g-living", -0.8, 1.2),
      capabilities: ["TEMPERATURE", "HUMIDITY", "BATTERY"],
      tempC: 21.4,
      humidityPct: 44,
      batteryPct: 70,
      connectivity: "ONLINE",
    },
    {
      label: "Living Camera",
      category: "CAMERA",
      roomKey: "g-living",
      ...at("g-living", 2, -2),
      capabilities: ["VIDEO", "AUDIO"],
      cameraState: "ONLINE",
      connectivity: "ONLINE",
    },
    {
      label: "Kitchen Motion",
      category: "MOTION_SENSOR",
      roomKey: "g-kitchen",
      ...at("g-kitchen"),
      capabilities: ["MOTION", "BATTERY"],
      motionState: "INACTIVE",
      batteryPct: 81,
      connectivity: "ONLINE",
    },
    {
      label: "Kitchen Climate",
      category: "ENV_SENSOR",
      roomKey: "g-kitchen",
      ...at("g-kitchen", 0.8, -0.8),
      capabilities: ["TEMPERATURE", "HUMIDITY", "SMOKE", "BATTERY"],
      tempC: 22.1,
      humidityPct: 48,
      batteryPct: 66,
      connectivity: "ONLINE",
    },
    {
      label: "Back Door Contact",
      category: "CONTACT_SENSOR",
      roomKey: "g-kitchen",
      ...at("g-kitchen", 0, 1.6),
      capabilities: ["CONTACT", "BATTERY"],
      doorState: "CLOSED",
      batteryPct: 90,
      connectivity: "ONLINE",
    },
    {
      label: "Garage Door Contact",
      category: "CONTACT_SENSOR",
      roomKey: "g-garage",
      ...at("g-garage", 0, -2),
      capabilities: ["CONTACT", "BATTERY"],
      doorState: "CLOSED",
      batteryPct: 74,
      connectivity: "ONLINE",
    },
    {
      label: "Garage Motion",
      category: "MOTION_SENSOR",
      roomKey: "g-garage",
      ...at("g-garage", 1, 1),
      capabilities: ["MOTION", "BATTERY"],
      motionState: "INACTIVE",
      batteryPct: 69,
      connectivity: "ONLINE",
    },
    {
      label: "Driveway Camera",
      category: "CAMERA",
      roomKey: "g-garage",
      ...at("g-garage", -1.2, -1.5),
      capabilities: ["VIDEO"],
      cameraState: "ONLINE",
      connectivity: "ONLINE",
    },
    {
      label: "Utility Climate",
      category: "ENV_SENSOR",
      roomKey: "g-utility",
      ...at("g-utility"),
      capabilities: ["TEMPERATURE", "HUMIDITY", "SMOKE", "BATTERY"],
      tempC: 18.2,
      humidityPct: 52,
      batteryPct: 80,
      connectivity: "ONLINE",
    },
    {
      label: "Guest Bath Motion",
      category: "MOTION_SENSOR",
      roomKey: "g-bath",
      ...at("g-bath"),
      capabilities: ["MOTION", "BATTERY"],
      motionState: "INACTIVE",
      batteryPct: 77,
      connectivity: "ONLINE",
    },
    // First floor
    {
      label: "Landing Motion",
      category: "MOTION_SENSOR",
      roomKey: "f-landing",
      ...at("f-landing"),
      capabilities: ["MOTION", "BATTERY"],
      motionState: "INACTIVE",
      batteryPct: 83,
      connectivity: "ONLINE",
    },
    {
      label: "Upstairs Camera",
      category: "CAMERA",
      roomKey: "f-landing",
      ...at("f-landing", -0.9, -0.9),
      capabilities: ["VIDEO", "AUDIO"],
      cameraState: "ONLINE",
      connectivity: "ONLINE",
    },
    {
      label: "Master Motion",
      category: "MOTION_SENSOR",
      roomKey: "f-master",
      ...at("f-master", 1, 0.5),
      capabilities: ["MOTION", "BATTERY"],
      motionState: "INACTIVE",
      batteryPct: 91,
      connectivity: "ONLINE",
    },
    {
      label: "Master Climate",
      category: "ENV_SENSOR",
      roomKey: "f-master",
      ...at("f-master", -1.2, 1),
      capabilities: ["TEMPERATURE", "HUMIDITY", "BATTERY"],
      tempC: 20.6,
      humidityPct: 41,
      batteryPct: 72,
      connectivity: "ONLINE",
    },
    {
      label: "Master Window Contact",
      category: "CONTACT_SENSOR",
      roomKey: "f-master",
      ...at("f-master", 2.2, -2),
      capabilities: ["CONTACT", "BATTERY"],
      doorState: "CLOSED",
      batteryPct: 86,
      connectivity: "ONLINE",
    },
    {
      label: "Bedroom 2 Motion",
      category: "MOTION_SENSOR",
      roomKey: "f-bed2",
      ...at("f-bed2"),
      capabilities: ["MOTION", "BATTERY"],
      motionState: "INACTIVE",
      batteryPct: 79,
      connectivity: "ONLINE",
    },
    {
      label: "Bedroom 2 Window Contact",
      category: "CONTACT_SENSOR",
      roomKey: "f-bed2",
      ...at("f-bed2", -1.5, -2),
      capabilities: ["CONTACT", "BATTERY"],
      doorState: "CLOSED",
      batteryPct: 84,
      connectivity: "ONLINE",
    },
    {
      label: "Bedroom 3 Motion",
      category: "MOTION_SENSOR",
      roomKey: "f-bed3",
      ...at("f-bed3"),
      capabilities: ["MOTION", "BATTERY"],
      motionState: "INACTIVE",
      batteryPct: 75,
      connectivity: "ONLINE",
    },
    {
      label: "Main Bath Motion",
      category: "MOTION_SENSOR",
      roomKey: "f-bath",
      ...at("f-bath"),
      capabilities: ["MOTION", "BATTERY"],
      motionState: "INACTIVE",
      batteryPct: 82,
      connectivity: "ONLINE",
    },
    {
      label: "Office Motion",
      category: "MOTION_SENSOR",
      roomKey: "f-office",
      ...at("f-office"),
      capabilities: ["MOTION", "BATTERY"],
      motionState: "INACTIVE",
      batteryPct: 88,
      connectivity: "ONLINE",
    },
    {
      label: "Office Climate",
      category: "ENV_SENSOR",
      roomKey: "f-office",
      ...at("f-office", 1, 0),
      capabilities: ["TEMPERATURE", "HUMIDITY", "BATTERY"],
      tempC: 21.0,
      humidityPct: 43,
      batteryPct: 68,
      connectivity: "ONLINE",
    },
  ];
}

const OPENINGS: OpeningSpec[] = [
  {
    roomKey: "g-hall",
    kind: "door",
    isExterior: true,
    wallSegmentIndex: 0,
    offsetMeters: 1.0,
    widthMeters: 0.9,
    deviceLabel: "Front Door Contact",
  },
  {
    roomKey: "g-kitchen",
    kind: "door",
    isExterior: true,
    wallSegmentIndex: 2,
    offsetMeters: 1.0,
    widthMeters: 0.9,
    deviceLabel: "Back Door Contact",
  },
  {
    roomKey: "g-garage",
    kind: "door",
    isExterior: true,
    wallSegmentIndex: 0,
    offsetMeters: 1.2,
    widthMeters: 2.4,
    deviceLabel: "Garage Door Contact",
  },
  {
    roomKey: "g-living",
    kind: "window",
    wallSegmentIndex: 1,
    offsetMeters: 1.5,
    widthMeters: 1.4,
  },
  {
    roomKey: "g-living",
    kind: "window",
    wallSegmentIndex: 0,
    offsetMeters: 1.8,
    widthMeters: 1.2,
  },
  {
    roomKey: "g-kitchen",
    kind: "window",
    wallSegmentIndex: 1,
    offsetMeters: 0.8,
    widthMeters: 1.0,
  },
  {
    roomKey: "f-master",
    kind: "window",
    wallSegmentIndex: 1,
    offsetMeters: 1.5,
    widthMeters: 1.2,
    deviceLabel: "Master Window Contact",
  },
  {
    roomKey: "f-bed2",
    kind: "window",
    wallSegmentIndex: 3,
    offsetMeters: 1.2,
    widthMeters: 1.0,
    deviceLabel: "Bedroom 2 Window Contact",
  },
  {
    roomKey: "f-bed3",
    kind: "window",
    wallSegmentIndex: 1,
    offsetMeters: 1.5,
    widthMeters: 1.0,
  },
  {
    roomKey: "f-office",
    kind: "window",
    wallSegmentIndex: 3,
    offsetMeters: 1.0,
    widthMeters: 1.0,
  },
];

async function main() {
  const { prisma } = await import("@homeguard/database");
  const { hashPassword } = await import("better-auth/crypto");

  async function ensureDemoUser() {
    let user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: DEMO_EMAIL,
          name: DEMO_NAME,
          emailVerified: true,
        },
      });
    }

    const passwordHash = await hashPassword(DEMO_PASSWORD);
    const existingAccount = await prisma.account.findFirst({
      where: { userId: user.id, providerId: "credential" },
    });

    if (!existingAccount) {
      await prisma.account.create({
        data: {
          userId: user.id,
          accountId: user.id,
          providerId: "credential",
          password: passwordHash,
        },
      });
    } else {
      // Keep password in sync with the documented demo credentials.
      await prisma.account.update({
        where: { id: existingAccount.id },
        data: { password: passwordHash },
      });
    }

    return user;
  }

  async function seedFloor(
    propertyId: string,
    name: string,
    level: number,
    rooms: RectRoom[],
    roomIdByKey: Map<string, string>,
  ) {
    let floor = await prisma.floor.findFirst({
      where: { propertyId, level },
    });
    if (!floor) {
      floor = await prisma.floor.create({
        data: { propertyId, name, level },
      });
    } else if (floor.name !== name) {
      floor = await prisma.floor.update({
        where: { id: floor.id },
        data: { name },
      });
    }

    for (const room of rooms) {
      let existing = await prisma.room.findFirst({
        where: { floorId: floor.id, name: room.name },
      });
      if (!existing) {
        existing = await prisma.room.create({
          data: {
            floorId: floor.id,
            name: room.name,
            kind: room.kind,
            polygon: rect(
              room.x,
              room.y,
              room.width,
              room.height,
            ) as unknown as Prisma.InputJsonValue,
          },
        });
      }
      roomIdByKey.set(room.key, existing.id);
    }
  }

  async function seedProperty(userId: string) {
    let property = await prisma.property.findFirst({
      where: { name: PROPERTY_NAME, memberships: { some: { userId } } },
    });

    if (property && RESET) {
      await prisma.property.delete({ where: { id: property.id } });
      property = null;
    }

    if (property) {
      const roomCount = await prisma.room.count({
        where: { floor: { propertyId: property.id } },
      });
      const deviceCount = await prisma.device.count({ where: { propertyId: property.id } });
      if (roomCount >= 10 && deviceCount >= 20) {
        return { property, created: false };
      }
      // Incomplete prior seed — wipe and rebuild.
      await prisma.property.delete({ where: { id: property.id } });
      property = null;
    }

    property = await prisma.property.create({
      data: {
        name: PROPERTY_NAME,
        timezone: TIMEZONE,
        memberships: { create: { userId, role: "OWNER" } },
        securityState: { create: {} },
      },
    });

    const roomIdByKey = new Map<string, string>();
    await seedFloor(property.id, "Ground", 0, GROUND_ROOMS, roomIdByKey);
    await seedFloor(property.id, "First", 1, FIRST_ROOMS, roomIdByKey);

    const allRooms = [...GROUND_ROOMS, ...FIRST_ROOMS];
    const devices = buildDevices(allRooms);
    const deviceIdByLabel = new Map<string, string>();

    for (const spec of devices) {
      const roomId = roomIdByKey.get(spec.roomKey);
      if (!roomId) throw new Error(`Missing room for device ${spec.label}`);

      const created = await prisma.device.create({
        data: {
          propertyId: property.id,
          roomId,
          label: spec.label,
          category: spec.category,
          provider: "SIMULATION",
          connectivity: spec.connectivity ?? "ONLINE",
          lastSeenAt: new Date(),
          positionX: spec.positionX,
          positionY: spec.positionY,
          ...(spec.doorState !== undefined ? { doorState: spec.doorState } : {}),
          ...(spec.lockState !== undefined ? { lockState: spec.lockState } : {}),
          ...(spec.motionState !== undefined ? { motionState: spec.motionState } : {}),
          ...(spec.cameraState !== undefined ? { cameraState: spec.cameraState } : {}),
          ...(spec.batteryPct !== undefined ? { batteryPct: spec.batteryPct } : {}),
          ...(spec.tempC !== undefined ? { tempC: spec.tempC } : {}),
          ...(spec.humidityPct !== undefined ? { humidityPct: spec.humidityPct } : {}),
          capabilities: {
            create: spec.capabilities.map((capability) => ({ capability })),
          },
        },
      });
      deviceIdByLabel.set(spec.label, created.id);
    }

    for (const opening of OPENINGS) {
      const roomId = roomIdByKey.get(opening.roomKey);
      if (!roomId) throw new Error(`Missing room for opening in ${opening.roomKey}`);
      const deviceId = opening.deviceLabel ? deviceIdByLabel.get(opening.deviceLabel) : undefined;
      const wallOffset = {
        wallSegmentIndex: opening.wallSegmentIndex,
        offsetMeters: opening.offsetMeters,
        widthMeters: opening.widthMeters,
      } as unknown as Prisma.InputJsonValue;

      if (opening.kind === "door") {
        await prisma.door.create({
          data: {
            roomId,
            isExterior: opening.isExterior ?? false,
            wallOffset,
            ...(deviceId !== undefined ? { deviceId } : {}),
          },
        });
      } else {
        await prisma.window.create({
          data: {
            roomId,
            wallOffset,
            ...(deviceId !== undefined ? { deviceId } : {}),
          },
        });
      }
    }

    const perimeterRoomKeys = ["g-hall", "g-kitchen", "g-garage", "g-living"];
    const upstairsRoomKeys = ["f-landing", "f-master", "f-bed2", "f-bed3", "f-office", "f-bath"];

    const perimeter = await prisma.securityZone.create({
      data: {
        propertyId: property.id,
        name: "Perimeter",
        modeLinks: { create: [{ mode: "AWAY" }, { mode: "NIGHT" }, { mode: "HOME" }] },
      },
    });
    for (const key of perimeterRoomKeys) {
      const roomId = roomIdByKey.get(key);
      if (!roomId) continue;
      await prisma.zoneRoom.create({ data: { zoneId: perimeter.id, roomId } });
    }

    const upstairs = await prisma.securityZone.create({
      data: {
        propertyId: property.id,
        name: "Upstairs",
        modeLinks: { create: [{ mode: "AWAY" }, { mode: "NIGHT" }] },
      },
    });
    for (const key of upstairsRoomKeys) {
      const roomId = roomIdByKey.get(key);
      if (!roomId) continue;
      await prisma.zoneRoom.create({ data: { zoneId: upstairs.id, roomId } });
    }

    for (const label of [
      "Front Door Contact",
      "Back Door Contact",
      "Garage Door Contact",
      "Living Motion",
      "Kitchen Motion",
    ]) {
      const deviceId = deviceIdByLabel.get(label);
      if (!deviceId) continue;
      await prisma.zoneDevice.create({
        data: { zoneId: perimeter.id, deviceId },
      });
    }
    for (const label of [
      "Landing Motion",
      "Master Motion",
      "Master Window Contact",
      "Bedroom 2 Window Contact",
    ]) {
      const deviceId = deviceIdByLabel.get(label);
      if (!deviceId) continue;
      await prisma.zoneDevice.create({
        data: { zoneId: upstairs.id, deviceId },
      });
    }

    return { property, created: true };
  }

  const user = await ensureDemoUser();
  const { property, created } = await seedProperty(user.id);

  const floors = await prisma.floor.count({ where: { propertyId: property.id } });
  const rooms = await prisma.room.count({ where: { floor: { propertyId: property.id } } });
  const devices = await prisma.device.count({ where: { propertyId: property.id } });

  console.log(
    created
      ? "Seeded demo property."
      : "Demo property already present (use DEMO_RESET=1 to rebuild).",
  );
  console.log(`DEMO_EMAIL=${DEMO_EMAIL}`);
  console.log(`DEMO_PASSWORD=${DEMO_PASSWORD}`);
  console.log(`DEMO_PROPERTY_ID=${property.id}`);
  console.log(`DEMO_PROPERTY_NAME=${PROPERTY_NAME}`);
  console.log(`floors=${floors} rooms=${rooms} devices=${devices}`);
  console.log(`Sign in at http://localhost:3000/sign-in then open /properties/${property.id}`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
