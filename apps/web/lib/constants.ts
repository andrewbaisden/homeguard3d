/**
 * Mirrors enums in packages/database/prisma/schema.prisma as plain
 * literal arrays. Kept independent of @homeguard/database (which
 * instantiates a Prisma client at module load) so these stay safe to
 * import from Client Components — see AGENTS.md on package boundaries.
 */
export const ROOM_KINDS = [
  "LIVING_ROOM",
  "KITCHEN",
  "BEDROOM",
  "BATHROOM",
  "OFFICE",
  "HALLWAY",
  "GARAGE",
  "UTILITY",
  "GARDEN",
  "OTHER",
] as const;

export type RoomKindLiteral = (typeof ROOM_KINDS)[number];

/** Rectangle wall segments, matching the order rectanglePolygon() emits points in. */
export const WALL_SEGMENTS = [
  { index: 0, label: "North" },
  { index: 1, label: "East" },
  { index: 2, label: "South" },
  { index: 3, label: "West" },
] as const;
