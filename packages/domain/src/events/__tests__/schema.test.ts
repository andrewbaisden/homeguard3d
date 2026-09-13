import { describe, expect, it } from "vitest";
import { domainEventSchema } from "../schema";

function baseEvent(overrides: Record<string, unknown> = {}) {
  return {
    eventId: "evt_1",
    propertyId: "prop_1",
    deviceId: "dev_1",
    source: "SIMULATION",
    occurredAt: "2026-01-01T00:00:00.000Z",
    type: "door.opened",
    metadata: {},
    ...overrides,
  };
}

describe("domainEventSchema", () => {
  it.each([
    "door.opened",
    "door.closed",
    "lock.locked",
    "lock.unlocked",
    "lock.jammed",
    "motion.started",
    "motion.cleared",
    "camera.online",
    "camera.offline",
    "camera.recording",
    "device.online",
    "device.stale",
    "device.offline",
  ])("accepts a valid %s event", (type) => {
    const result = domainEventSchema.safeParse(baseEvent({ type }));
    expect(result.success).toBe(true);
  });

  it("rejects an unknown event type", () => {
    const result = domainEventSchema.safeParse(baseEvent({ type: "unknown.thing" }));
    expect(result.success).toBe(false);
  });

  it("rejects a device event with no deviceId", () => {
    const { deviceId: _omit, ...withoutDeviceId } = baseEvent();
    const result = domainEventSchema.safeParse(withoutDeviceId);
    expect(result.success).toBe(false);
  });

  it("rejects an invalid source", () => {
    const result = domainEventSchema.safeParse(baseEvent({ source: "NOT_A_SOURCE" }));
    expect(result.success).toBe(false);
  });

  it("rejects a non-ISO occurredAt", () => {
    const result = domainEventSchema.safeParse(baseEvent({ occurredAt: "not-a-date" }));
    expect(result.success).toBe(false);
  });

  it("rejects unexpected metadata fields", () => {
    const result = domainEventSchema.safeParse(baseEvent({ metadata: { unexpected: true } }));
    expect(result.success).toBe(false);
  });

  it("accepts optional roomId, entityId, and sequence", () => {
    const result = domainEventSchema.safeParse(
      baseEvent({ roomId: "room_1", entityId: "entity_1", sequence: 42 }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects a negative sequence", () => {
    const result = domainEventSchema.safeParse(baseEvent({ sequence: -1 }));
    expect(result.success).toBe(false);
  });
});
