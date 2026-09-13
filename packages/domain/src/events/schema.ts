// Event envelope + per-type Zod schemas — Phase 3.
//
// This is the actual closed vocabulary of event `type` strings (the
// Event.type column in Prisma is intentionally a plain String — see
// schema.prisma comment and DECISIONS.md). A discriminated union keyed
// on `type` validates `metadata` shape per event.
//
// Every event carries: eventId, propertyId, deviceId?, roomId?,
// entityId?, type, source, occurredAt, sequence?, metadata — see
// ARCHITECTURE.md section G.
export {};
