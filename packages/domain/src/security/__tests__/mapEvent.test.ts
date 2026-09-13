import { describe, expect, it } from "vitest";
import type { DomainEvent } from "../../events/schema";
import { mapToSecurityDomainEvent } from "../mapEvent";

function baseFields() {
  return {
    eventId: "evt_1",
    propertyId: "prop_1",
    source: "USER" as const,
    occurredAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("mapToSecurityDomainEvent", () => {
  it("maps security.arm_requested, always with an empty openHotZoneDeviceIds", () => {
    const event: DomainEvent = {
      ...baseFields(),
      type: "security.arm_requested",
      metadata: { mode: "AWAY", override: false },
    };
    expect(mapToSecurityDomainEvent(event)).toEqual({
      type: "arm.requested",
      mode: "AWAY",
      openHotZoneDeviceIds: [],
      override: false,
    });
  });

  it("maps security.arm_cancelled", () => {
    const event: DomainEvent = { ...baseFields(), type: "security.arm_cancelled", metadata: {} };
    expect(mapToSecurityDomainEvent(event)).toEqual({ type: "arm.cancelled" });
  });

  it("maps security.exit_delay_expired", () => {
    const event: DomainEvent = {
      ...baseFields(),
      source: "SYSTEM",
      type: "security.exit_delay_expired",
      metadata: {},
    };
    expect(mapToSecurityDomainEvent(event)).toEqual({ type: "exit_delay.expired" });
  });

  it("maps security.sensor_triggered, carrying deviceId and isEntryPoint through", () => {
    const event: DomainEvent = {
      ...baseFields(),
      source: "SYSTEM",
      deviceId: "dev_front_door",
      type: "security.sensor_triggered",
      metadata: { isEntryPoint: true },
    };
    expect(mapToSecurityDomainEvent(event)).toEqual({
      type: "sensor.triggered",
      deviceId: "dev_front_door",
      isEntryPoint: true,
    });
  });

  it("maps security.entry_delay_expired", () => {
    const event: DomainEvent = {
      ...baseFields(),
      source: "SYSTEM",
      type: "security.entry_delay_expired",
      metadata: {},
    };
    expect(mapToSecurityDomainEvent(event)).toEqual({ type: "entry_delay.expired" });
  });

  it("maps security.alert_grace_expired", () => {
    const event: DomainEvent = {
      ...baseFields(),
      source: "SYSTEM",
      type: "security.alert_grace_expired",
      metadata: {},
    };
    expect(mapToSecurityDomainEvent(event)).toEqual({ type: "alert_grace.expired" });
  });

  it("maps security.disarmed", () => {
    const event: DomainEvent = { ...baseFields(), type: "security.disarmed", metadata: {} };
    expect(mapToSecurityDomainEvent(event)).toEqual({ type: "disarm.requested" });
  });

  it("returns null for a device-state event", () => {
    const event: DomainEvent = {
      ...baseFields(),
      deviceId: "dev_1",
      type: "door.opened",
      metadata: {},
    };
    expect(mapToSecurityDomainEvent(event)).toBeNull();
  });
});
