import { describe, expect, it } from "vitest";
import {
  ALERT_GRACE_MS,
  ENTRY_DELAY_MS,
  EXIT_DELAY_MS,
  type SecurityDomainEvent,
  type SecurityStateSnapshot,
  transition,
} from "../stateMachine";

function state(
  machineState: SecurityStateSnapshot["machineState"],
  mode: SecurityStateSnapshot["mode"] = "DISARMED",
): SecurityStateSnapshot {
  return { machineState, mode };
}

describe("transition — happy path", () => {
  it("IDLE_DISARMED + arm.requested (no open sensors) -> EXIT_DELAY, schedules the exit timer", () => {
    const result = transition(state("IDLE_DISARMED"), {
      type: "arm.requested",
      mode: "AWAY",
      openHotZoneDeviceIds: [],
      override: false,
    });
    expect(result.next).toEqual({ machineState: "EXIT_DELAY", mode: "AWAY" });
    expect(result.effects).toEqual([
      { kind: "SCHEDULE_TIMER", timer: "EXIT_DELAY", delayMs: EXIT_DELAY_MS },
    ]);
    expect(result.rejected).toBeUndefined();
  });

  it("EXIT_DELAY + exit_delay.expired -> ARMED, preserving the armed mode", () => {
    const result = transition(state("EXIT_DELAY", "NIGHT"), { type: "exit_delay.expired" });
    expect(result.next).toEqual({ machineState: "ARMED", mode: "NIGHT" });
    expect(result.effects).toEqual([]);
  });

  it("EXIT_DELAY + arm.cancelled -> IDLE_DISARMED, cancels timers", () => {
    const result = transition(state("EXIT_DELAY", "AWAY"), { type: "arm.cancelled" });
    expect(result.next).toEqual({ machineState: "IDLE_DISARMED", mode: "DISARMED" });
    expect(result.effects).toEqual([{ kind: "CANCEL_TIMERS" }]);
  });

  it("ARMED + sensor.triggered (entry point) -> ENTRY_DELAY, schedules the entry timer", () => {
    const result = transition(state("ARMED", "AWAY"), {
      type: "sensor.triggered",
      deviceId: "dev_1",
      isEntryPoint: true,
    });
    expect(result.next).toEqual({ machineState: "ENTRY_DELAY", mode: "AWAY" });
    expect(result.effects).toEqual([
      { kind: "SCHEDULE_TIMER", timer: "ENTRY_DELAY", delayMs: ENTRY_DELAY_MS },
    ]);
  });

  it("ARMED + sensor.triggered (not an entry point) -> ALERT, schedules the grace timer", () => {
    const result = transition(state("ARMED", "AWAY"), {
      type: "sensor.triggered",
      deviceId: "dev_2",
      isEntryPoint: false,
    });
    expect(result.next).toEqual({ machineState: "ALERT", mode: "AWAY" });
    expect(result.effects).toEqual([
      { kind: "SCHEDULE_TIMER", timer: "ALERT_GRACE", delayMs: ALERT_GRACE_MS },
    ]);
  });

  it("ENTRY_DELAY + entry_delay.expired -> ALARM, raises the alarm", () => {
    const result = transition(state("ENTRY_DELAY", "AWAY"), { type: "entry_delay.expired" });
    expect(result.next).toEqual({ machineState: "ALARM", mode: "AWAY" });
    expect(result.effects).toEqual([{ kind: "RAISE_ALARM" }]);
  });

  it("ALERT + alert_grace.expired -> ALARM, raises the alarm", () => {
    const result = transition(state("ALERT", "HOME"), { type: "alert_grace.expired" });
    expect(result.next).toEqual({ machineState: "ALARM", mode: "HOME" });
    expect(result.effects).toEqual([{ kind: "RAISE_ALARM" }]);
  });
});

describe("transition — disarm is always allowed from an armed-ish state", () => {
  it.each(["ARMED", "ENTRY_DELAY", "ALERT", "ALARM"] as const)(
    "%s + disarm.requested -> IDLE_DISARMED",
    (machineState) => {
      const result = transition(state(machineState, "AWAY"), { type: "disarm.requested" });
      expect(result.next).toEqual({ machineState: "IDLE_DISARMED", mode: "DISARMED" });
      expect(result.rejected).toBeUndefined();
    },
  );

  it("clears the alarm specifically (not just a generic cancel) when disarming from ALARM", () => {
    const result = transition(state("ALARM", "AWAY"), { type: "disarm.requested" });
    expect(result.effects).toEqual([{ kind: "CLEAR_ALARM" }]);
  });
});

describe("transition — arm guard", () => {
  it("rejects arming when hot-zone devices are open and override is false", () => {
    const result = transition(state("IDLE_DISARMED"), {
      type: "arm.requested",
      mode: "AWAY",
      openHotZoneDeviceIds: ["dev_front_door"],
      override: false,
    });
    expect(result.next).toEqual(state("IDLE_DISARMED"));
    expect(result.effects).toEqual([]);
    expect(result.rejected).toEqual({
      reason: "OPEN_HOT_ZONE_DEVICES",
      deviceIds: ["dev_front_door"],
    });
  });

  it("allows arming with open hot-zone devices when override is true", () => {
    const result = transition(state("IDLE_DISARMED"), {
      type: "arm.requested",
      mode: "AWAY",
      openHotZoneDeviceIds: ["dev_front_door"],
      override: true,
    });
    expect(result.next.machineState).toBe("EXIT_DELAY");
    expect(result.rejected).toBeUndefined();
  });
});

describe("transition — illegal/inapplicable events are idempotent no-ops", () => {
  const allEvents: SecurityDomainEvent[] = [
    { type: "arm.requested", mode: "AWAY", openHotZoneDeviceIds: [], override: false },
    { type: "arm.cancelled" },
    { type: "exit_delay.expired" },
    { type: "sensor.triggered", deviceId: "dev_1", isEntryPoint: false },
    { type: "entry_delay.expired" },
    { type: "alert_grace.expired" },
    { type: "disarm.requested" },
  ];

  const legalEventsByState: Record<
    SecurityStateSnapshot["machineState"],
    SecurityDomainEvent["type"][]
  > = {
    IDLE_DISARMED: ["arm.requested"],
    EXIT_DELAY: ["exit_delay.expired", "arm.cancelled"],
    ARMED: ["sensor.triggered", "disarm.requested"],
    ENTRY_DELAY: ["entry_delay.expired", "disarm.requested"],
    ALERT: ["alert_grace.expired", "disarm.requested"],
    ALARM: ["disarm.requested"],
    DISARMING: [],
  };

  for (const machineState of Object.keys(
    legalEventsByState,
  ) as SecurityStateSnapshot["machineState"][]) {
    if (machineState === "DISARMING") continue; // DISARMING is a pass-through, not a stable resting state

    const legal = new Set(legalEventsByState[machineState]);
    const illegalEvents = allEvents.filter((event) => !legal.has(event.type));

    for (const event of illegalEvents) {
      it(`${machineState} ignores ${event.type} (leaves state unchanged, no effects)`, () => {
        const current = state(machineState, "AWAY");
        const result = transition(current, event);
        expect(result.next).toEqual(current);
        expect(result.effects).toEqual([]);
        expect(result.rejected).toBeUndefined();
      });
    }
  }
});

describe("transition — DISARMING", () => {
  it("passes through to IDLE_DISARMED (reserved for a future async disarm flow)", () => {
    const result = transition(state("DISARMING", "AWAY"), { type: "disarm.requested" });
    expect(result.next).toEqual({ machineState: "IDLE_DISARMED", mode: "DISARMED" });
  });
});
