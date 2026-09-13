import { z } from "zod";

/**
 * Event envelope + per-type Zod schemas — the actual closed vocabulary
 * of event `type` strings (Event.type in Prisma is a plain String —
 * see schema.prisma comment and DECISIONS.md ADR for why). Every event
 * carries eventId, propertyId, deviceId?, roomId?, entityId?, type,
 * source, occurredAt, sequence?, metadata — see ARCHITECTURE.md
 * section G.
 *
 * Covers Phase 3/4's device-state events and Phase 5's security
 * events. Alerts/automation (Phase 11) and occupancy (Phase 12) event
 * types are added to this union when those phases implement the
 * reducer logic that consumes them — see AGENTS.md ("adding a new
 * event type means adding a case here, not a migration").
 */

export const eventSourceSchema = z.enum(["DEVICE", "USER", "AUTOMATION", "SIMULATION", "SYSTEM"]);
export type EventSource = z.infer<typeof eventSourceSchema>;

/** Mirrors packages/domain/src/security/stateMachine.ts's SecurityMode. */
export const securityModeSchema = z.enum(["DISARMED", "HOME", "NIGHT", "AWAY"]);

const sharedFields = {
  eventId: z.string().min(1),
  propertyId: z.string().min(1),
  roomId: z.string().min(1).optional(),
  entityId: z.string().min(1).optional(),
  source: eventSourceSchema,
  sequence: z.number().int().nonnegative().optional(),
  occurredAt: z.string().datetime(),
};

/** Events scoped to exactly one device (most device-state and the sensor-trigger event). */
function deviceEvent<T extends string, Shape extends z.ZodRawShape>(type: T, metadataShape: Shape) {
  return z.object({
    ...sharedFields,
    deviceId: z.string().min(1),
    type: z.literal(type),
    metadata: z.object(metadataShape).strict(),
  });
}

/** Events scoped to the property as a whole — no single device is involved. */
function propertyEvent<T extends string, Shape extends z.ZodRawShape>(
  type: T,
  metadataShape: Shape,
) {
  return z.object({
    ...sharedFields,
    type: z.literal(type),
    metadata: z.object(metadataShape).strict(),
  });
}

export const domainEventSchema = z.discriminatedUnion("type", [
  // Device state (Phase 3/4)
  deviceEvent("door.opened", {}),
  deviceEvent("door.closed", {}),
  deviceEvent("lock.locked", {}),
  deviceEvent("lock.unlocked", {}),
  deviceEvent("lock.jammed", {}),
  deviceEvent("motion.started", {}),
  deviceEvent("motion.cleared", {}),
  deviceEvent("camera.online", {}),
  deviceEvent("camera.offline", {}),
  deviceEvent("camera.recording", {}),
  deviceEvent("device.online", {}),
  deviceEvent("device.stale", {}),
  deviceEvent("device.offline", {}),

  // Security (Phase 5) — see ARCHITECTURE.md section E.
  propertyEvent("security.arm_requested", { mode: securityModeSchema, override: z.boolean() }),
  propertyEvent("security.arm_cancelled", {}),
  propertyEvent("security.exit_delay_expired", {}),
  deviceEvent("security.sensor_triggered", { isEntryPoint: z.boolean() }),
  propertyEvent("security.entry_delay_expired", {}),
  propertyEvent("security.alert_grace_expired", {}),
  propertyEvent("security.disarmed", {}),
]);

export type DomainEvent = z.infer<typeof domainEventSchema>;
export type DomainEventType = DomainEvent["type"];
