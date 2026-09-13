import { z } from "zod";

/**
 * Event envelope + per-type Zod schemas — the actual closed vocabulary
 * of event `type` strings (Event.type in Prisma is a plain String —
 * see schema.prisma comment and DECISIONS.md ADR for why). Every event
 * carries eventId, propertyId, deviceId?, roomId?, entityId?, type,
 * source, occurredAt, sequence?, metadata — see ARCHITECTURE.md
 * section G.
 *
 * Scoped to Phase 3/4's device-state-affecting event types only.
 * Security (Phase 5), alerts/automation (Phase 11), and occupancy
 * (Phase 12) event types are added to this union when those phases
 * implement the reducer logic that consumes them — see AGENTS.md
 * ("adding a new event type means adding a case here, not a
 * migration").
 */

export const eventSourceSchema = z.enum(["DEVICE", "USER", "AUTOMATION", "SIMULATION", "SYSTEM"]);
export type EventSource = z.infer<typeof eventSourceSchema>;

const sharedFields = {
  eventId: z.string().min(1),
  propertyId: z.string().min(1),
  roomId: z.string().min(1).optional(),
  entityId: z.string().min(1).optional(),
  source: eventSourceSchema,
  sequence: z.number().int().nonnegative().optional(),
  occurredAt: z.string().datetime(),
};

/** All device-state events are scoped to exactly one device. */
function deviceEvent<T extends string>(type: T) {
  return z.object({
    ...sharedFields,
    deviceId: z.string().min(1),
    type: z.literal(type),
    metadata: z.object({}).strict(),
  });
}

export const domainEventSchema = z.discriminatedUnion("type", [
  deviceEvent("door.opened"),
  deviceEvent("door.closed"),
  deviceEvent("lock.locked"),
  deviceEvent("lock.unlocked"),
  deviceEvent("lock.jammed"),
  deviceEvent("motion.started"),
  deviceEvent("motion.cleared"),
  deviceEvent("camera.online"),
  deviceEvent("camera.offline"),
  deviceEvent("camera.recording"),
  deviceEvent("device.online"),
  deviceEvent("device.stale"),
  deviceEvent("device.offline"),
]);

export type DomainEvent = z.infer<typeof domainEventSchema>;
export type DomainEventType = DomainEvent["type"];
