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

  describe("security events", () => {
    function propertyEvent(overrides: Record<string, unknown> = {}) {
      return {
        eventId: "evt_1",
        propertyId: "prop_1",
        source: "USER",
        occurredAt: "2026-01-01T00:00:00.000Z",
        ...overrides,
      };
    }

    it("accepts a valid security.arm_requested event", () => {
      const result = domainEventSchema.safeParse(
        propertyEvent({
          type: "security.arm_requested",
          metadata: { mode: "AWAY", override: false },
        }),
      );
      expect(result.success).toBe(true);
    });

    it("rejects security.arm_requested with an invalid mode", () => {
      const result = domainEventSchema.safeParse(
        propertyEvent({
          type: "security.arm_requested",
          metadata: { mode: "NOT_A_MODE", override: false },
        }),
      );
      expect(result.success).toBe(false);
    });

    it("does not require a deviceId for property-scoped security events", () => {
      const result = domainEventSchema.safeParse(
        propertyEvent({ type: "security.disarmed", metadata: {} }),
      );
      expect(result.success).toBe(true);
    });

    it.each([
      "security.arm_cancelled",
      "security.exit_delay_expired",
      "security.entry_delay_expired",
      "security.alert_grace_expired",
      "security.disarmed",
    ])("accepts a valid %s event", (type) => {
      const result = domainEventSchema.safeParse(propertyEvent({ type, metadata: {} }));
      expect(result.success).toBe(true);
    });

    it("requires a deviceId for security.sensor_triggered", () => {
      const result = domainEventSchema.safeParse(
        propertyEvent({
          source: "SYSTEM",
          type: "security.sensor_triggered",
          metadata: { isEntryPoint: true },
        }),
      );
      expect(result.success).toBe(false);
    });

    it("accepts a valid security.sensor_triggered event", () => {
      const result = domainEventSchema.safeParse(
        propertyEvent({
          source: "SYSTEM",
          deviceId: "dev_1",
          type: "security.sensor_triggered",
          metadata: { isEntryPoint: false },
        }),
      );
      expect(result.success).toBe(true);
    });
  });
});
