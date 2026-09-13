import { describe, expect, it } from "vitest";
import type { DomainEvent } from "../../events/schema";
import { reduceDeviceEvent } from "../reducer";

function event(type: DomainEvent["type"]): DomainEvent {
  return {
    eventId: "evt_1",
    propertyId: "prop_1",
    deviceId: "dev_1",
    source: "SIMULATION",
    occurredAt: "2026-01-01T00:00:00.000Z",
    type,
    metadata: {},
  } as DomainEvent;
}

describe("reduceDeviceEvent", () => {
  it.each([
    ["door.opened", { doorState: "OPEN" }],
    ["door.closed", { doorState: "CLOSED" }],
    ["lock.locked", { lockState: "LOCKED" }],
    ["lock.unlocked", { lockState: "UNLOCKED" }],
    ["lock.jammed", { lockState: "JAMMED" }],
    ["motion.started", { motionState: "ACTIVE" }],
    ["motion.cleared", { motionState: "INACTIVE" }],
    ["camera.online", { cameraState: "ONLINE", connectivity: "ONLINE" }],
    ["camera.offline", { cameraState: "OFFLINE", connectivity: "OFFLINE" }],
    ["camera.recording", { cameraState: "RECORDING" }],
    ["device.online", { connectivity: "ONLINE" }],
    ["device.stale", { connectivity: "STALE" }],
    ["device.offline", { connectivity: "OFFLINE" }],
  ] as const)("maps %s to %o", (type, expectedPatch) => {
    expect(reduceDeviceEvent(event(type))).toEqual(expectedPatch);
  });

  it("is a pure function — same input always produces an equal, independent patch", () => {
    const input = event("door.opened");
    const first = reduceDeviceEvent(input);
    const second = reduceDeviceEvent(input);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });
});
