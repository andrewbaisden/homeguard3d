import { describe, expect, it } from "vitest";
import type { DomainEvent } from "../../events/schema";
import { type ReplayState, replayToTime } from "../replay";

const base: ReplayState = {
  devicesById: {
    "door-1": {
      id: "door-1",
      connectivity: "ONLINE",
      doorState: "CLOSED",
      lockState: null,
      motionState: null,
      cameraState: null,
      batteryPct: null,
      tempC: null,
      humidityPct: null,
      stateUpdatedAt: "2026-01-01T00:00:00.000Z",
      source: "DEVICE",
    },
  },
  security: {
    machineState: "IDLE_DISARMED",
    mode: "DISARMED",
    changedAt: "2026-01-01T00:00:00.000Z",
    source: "USER",
  },
};

describe("replayToTime", () => {
  it("matches stepwise live reduction for device + security events", () => {
    const events: DomainEvent[] = [
      {
        eventId: "1",
        propertyId: "p1",
        source: "USER",
        occurredAt: "2026-01-01T00:00:01.000Z",
        type: "security.arm_requested",
        metadata: { mode: "AWAY", override: true },
      },
      {
        eventId: "2",
        propertyId: "p1",
        source: "SYSTEM",
        occurredAt: "2026-01-01T00:00:02.000Z",
        type: "security.exit_delay_expired",
        metadata: {},
      },
      {
        eventId: "3",
        propertyId: "p1",
        deviceId: "door-1",
        source: "SIMULATION",
        occurredAt: "2026-01-01T00:00:03.000Z",
        type: "door.opened",
        metadata: {},
      },
    ];

    const replayed = replayToTime(base, events);
    expect(replayed.security.machineState).toBe("ARMED");
    expect(replayed.security.mode).toBe("AWAY");
    expect(replayed.devicesById["door-1"]?.doorState).toBe("OPEN");
    expect(replayed.devicesById["door-1"]?.source).toBe("SIMULATION");
  });
});
