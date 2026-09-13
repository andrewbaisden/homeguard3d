import { describe, expect, it } from "vitest";
import type { DomainEvent } from "../../events/schema";
import { evaluateAlertRules } from "../evaluate";

const baseSecurity = {
  machineState: "ARMED" as const,
  mode: "AWAY" as const,
};

function offlineEvent(): DomainEvent {
  return {
    eventId: "evt_offline",
    propertyId: "prop_1",
    deviceId: "dev_1",
    source: "SIMULATION",
    occurredAt: "2026-01-01T00:00:00.000Z",
    type: "device.offline",
    metadata: {},
  };
}

describe("evaluateAlertRules", () => {
  it("raises CRITICAL when the machine enters ALARM", () => {
    const event: DomainEvent = {
      eventId: "evt_alarm",
      propertyId: "prop_1",
      source: "SYSTEM",
      occurredAt: "2026-01-01T00:00:00.000Z",
      type: "security.entry_delay_expired",
      metadata: {},
    };
    const proposals = evaluateAlertRules(
      event,
      { security: { machineState: "ENTRY_DELAY", mode: "AWAY" } },
      { security: { machineState: "ALARM", mode: "AWAY" } },
    );
    expect(proposals).toEqual([{ severity: "CRITICAL", title: "Security alarm" }]);
  });

  it("does not re-raise while already in ALARM", () => {
    const event: DomainEvent = {
      eventId: "evt_again",
      propertyId: "prop_1",
      source: "SYSTEM",
      occurredAt: "2026-01-01T00:00:00.000Z",
      type: "security.entry_delay_expired",
      metadata: {},
    };
    expect(
      evaluateAlertRules(
        event,
        { security: { machineState: "ALARM", mode: "AWAY" } },
        { security: { machineState: "ALARM", mode: "AWAY" } },
      ),
    ).toEqual([]);
  });

  it("raises WARNING for device.offline", () => {
    expect(
      evaluateAlertRules(offlineEvent(), { security: baseSecurity }, { security: baseSecurity }),
    ).toEqual([{ severity: "WARNING", title: "Device went offline", deviceId: "dev_1" }]);
  });
});
