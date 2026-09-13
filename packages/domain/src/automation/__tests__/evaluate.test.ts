import { describe, expect, it } from "vitest";
import type { DomainEvent } from "../../events/schema";
import { evaluateAutomationRules } from "../evaluate";
import { automationRuleDefinitionSchema } from "../schema";

const event: DomainEvent = {
  eventId: "evt_1",
  propertyId: "prop_1",
  deviceId: "dev_1",
  source: "SIMULATION",
  occurredAt: "2026-01-01T00:00:00.000Z",
  type: "device.offline",
  metadata: {},
};

const previous = {
  security: { machineState: "ARMED" as const, mode: "AWAY" as const },
  devices: {
    dev_1: { connectivity: "ONLINE" as const, doorState: "CLOSED" as const },
  },
};

const next = {
  security: { machineState: "ARMED" as const, mode: "AWAY" as const },
  devices: {
    dev_1: { connectivity: "OFFLINE" as const, doorState: "CLOSED" as const },
  },
};

describe("automationRuleDefinitionSchema", () => {
  it("accepts a structured rule definition", () => {
    const parsed = automationRuleDefinitionSchema.safeParse({
      trigger: { kind: "event_type", type: "device.offline" },
      conditions: [{ kind: "security_mode", mode: "AWAY" }],
      actions: [{ kind: "RAISE_ALERT", severity: "WARNING", title: "Offline while Away" }],
    });
    expect(parsed.success).toBe(true);
  });
});

describe("evaluateAutomationRules", () => {
  it("returns matching actions when trigger and conditions hold", () => {
    const jobs = evaluateAutomationRules(event, previous, next, [
      {
        id: "rule_1",
        name: "Offline Away",
        enabled: true,
        definition: {
          trigger: { kind: "event_type", type: "device.offline" },
          conditions: [{ kind: "security_mode", mode: "AWAY" }],
          actions: [{ kind: "RAISE_ALERT", severity: "WARNING", title: "Offline while Away" }],
        },
      },
    ]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.action).toEqual({
      kind: "RAISE_ALERT",
      severity: "WARNING",
      title: "Offline while Away",
    });
  });

  it("is idempotent for the same inputs", () => {
    const rules = [
      {
        id: "rule_1",
        name: "Offline Away",
        enabled: true,
        definition: {
          trigger: { kind: "event_type" as const, type: "device.offline" },
          conditions: [{ kind: "security_mode" as const, mode: "AWAY" as const }],
          actions: [{ kind: "SEND_NOTIFICATION" as const, message: "Device offline" }],
        },
      },
    ];
    expect(evaluateAutomationRules(event, previous, next, rules)).toEqual(
      evaluateAutomationRules(event, previous, next, rules),
    );
  });

  it("skips disabled rules and unsatisfied conditions", () => {
    expect(
      evaluateAutomationRules(event, previous, next, [
        {
          id: "disabled",
          name: "Disabled",
          enabled: false,
          definition: {
            trigger: { kind: "event_type", type: "device.offline" },
            conditions: [],
            actions: [{ kind: "SEND_NOTIFICATION", message: "nope" }],
          },
        },
        {
          id: "wrong_mode",
          name: "Home only",
          enabled: true,
          definition: {
            trigger: { kind: "event_type", type: "device.offline" },
            conditions: [{ kind: "security_mode", mode: "HOME" }],
            actions: [{ kind: "SEND_NOTIFICATION", message: "nope" }],
          },
        },
      ]),
    ).toEqual([]);
  });
});
