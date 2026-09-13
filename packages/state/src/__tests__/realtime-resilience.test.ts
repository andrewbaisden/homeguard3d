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
  occupancy: {
    status: "UNKNOWN",
    confidence: 0,
    evidence: [],
    updatedAtMs: 0,
    simulated: false,
    rooms: {},
  },
};

const openEvent: DomainEvent = {
  eventId: "event-open",
  propertyId: "property-1",
  deviceId: "door-1",
  source: "SIMULATION",
  occurredAt: "2026-01-01T00:00:01.000Z",
  type: "door.opened",
  metadata: {},
};

describe("realtime resilience", () => {
  it("dedups duplicate SSE deliveries by eventId", () => {
    const live = projectRealtimeEvent(mergeOperationalSnapshot(undefined, initial), openEvent);
    const again = projectRealtimeEvent(live, openEvent);
    expect(again).toBe(live);
    expect(again.devicesById["door-1"]?.doorState).toBe("OPEN");
  });

  it("recovers missed events by hydrating a fresher reconnect snapshot", () => {
    const disconnected = mergeOperationalSnapshot(undefined, initial);
    const reconnectSnapshot: OperationalSnapshot = {
      ...initial,
      devices: [
        {
          ...initial.devices[0]!,
          doorState: "OPEN",
          stateUpdatedAt: "2026-01-01T00:00:05.000Z",
          source: "SIMULATION",
        },
      ],
      security: {
        machineState: "ARMED",
        mode: "AWAY",
        changedAt: "2026-01-01T00:00:04.000Z",
        source: "SIMULATION",
      },
    };
    const recovered = mergeOperationalSnapshot(disconnected, reconnectSnapshot);
    expect(recovered.devicesById["door-1"]?.doorState).toBe("OPEN");
    expect(recovered.security.machineState).toBe("ARMED");
  });

  it("does not let an older reconnect snapshot overwrite newer live events", () => {
    const live = projectRealtimeEvent(mergeOperationalSnapshot(undefined, initial), {
      ...openEvent,
      eventId: "event-live",
      occurredAt: "2026-01-01T00:00:10.000Z",
    });
    const staleSnapshot: OperationalSnapshot = {
      ...initial,
      devices: [
        {
          ...initial.devices[0]!,
          doorState: "CLOSED",
          stateUpdatedAt: "2026-01-01T00:00:00.000Z",
          source: "DEVICE",
        },
      ],
    };
    const reconciled = mergeOperationalSnapshot(live, staleSnapshot);
    expect(reconciled.devicesById["door-1"]?.doorState).toBe("OPEN");
  });
});
