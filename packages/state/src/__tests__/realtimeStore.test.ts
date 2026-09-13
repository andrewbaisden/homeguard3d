import type { DomainEvent } from "@homeguard/domain";
import { describe, expect, it } from "vitest";
import {
  type OperationalSnapshot,
  mergeOperationalSnapshot,
  projectRealtimeEvent,
} from "../realtimeStore";

const initial: OperationalSnapshot = {
  devices: [
    {
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
  ],
  security: {
    machineState: "IDLE_DISARMED",
    mode: "DISARMED",
    changedAt: "2026-01-01T00:00:00.000Z",
    source: "USER",
  },
};

describe("realtime projection", () => {
  it("projects one event identically for every renderer selector", () => {
    const state = mergeOperationalSnapshot(undefined, initial);
    const event: DomainEvent = {
      eventId: "event-1",
      propertyId: "property-1",
      deviceId: "door-1",
      source: "SIMULATION",
      occurredAt: "2026-01-01T00:00:01.000Z",
      type: "door.opened",
      metadata: {},
    };
    const projected = projectRealtimeEvent(state, event);

    expect(projected.devicesById["door-1"]?.doorState).toBe("OPEN");
    expect(projected.devicesById["door-1"]?.source).toBe("SIMULATION");
    expect(projectRealtimeEvent(projected, event)).toBe(projected);
  });

  it("does not let an older reconnect snapshot overwrite live state", () => {
    const live = projectRealtimeEvent(mergeOperationalSnapshot(undefined, initial), {
      eventId: "event-2",
      propertyId: "property-1",
      deviceId: "door-1",
      source: "DEVICE",
      occurredAt: "2026-01-01T00:00:02.000Z",
      type: "door.opened",
      metadata: {},
    });
    const reconciled = mergeOperationalSnapshot(live, initial);
    expect(reconciled.devicesById["door-1"]?.doorState).toBe("OPEN");
  });
});
