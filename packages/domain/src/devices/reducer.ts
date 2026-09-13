import type { DomainEvent } from "../events/schema";

/**
 * Patch to apply to a Device's operational-state columns. Only the
 * fields relevant to the triggering event are present — see
 * ARCHITECTURE.md section D (typed columns, only-relevant-ones-populated).
 */
export interface DeviceStatePatch {
  doorState?: "OPEN" | "CLOSED";
  lockState?: "LOCKED" | "UNLOCKED" | "JAMMED";
  motionState?: "ACTIVE" | "INACTIVE";
  cameraState?: "ONLINE" | "OFFLINE" | "RECORDING";
  connectivity?: "ONLINE" | "STALE" | "OFFLINE";
}

/**
 * Pure reducer: given a device-scoped domain event, returns the patch
 * to apply to that device's operational-state columns, or `null` if
 * the event doesn't affect device state. No I/O — the caller
 * (apps/realtime-service ingestion handler) applies the patch inside
 * the same transaction as the Event insert. See ARCHITECTURE.md
 * section H and AGENTS.md rule #2 ("never change without tests").
 *
 * The `never` case in `default` is a compile-time guarantee: adding a
 * new event type to the schema without a corresponding case here is a
 * type error, not a silent no-op.
 */
export function reduceDeviceEvent(event: DomainEvent): DeviceStatePatch {
  switch (event.type) {
    case "door.opened":
      return { doorState: "OPEN" };
    case "door.closed":
      return { doorState: "CLOSED" };
    case "lock.locked":
      return { lockState: "LOCKED" };
    case "lock.unlocked":
      return { lockState: "UNLOCKED" };
    case "lock.jammed":
      return { lockState: "JAMMED" };
    case "motion.started":
      return { motionState: "ACTIVE" };
    case "motion.cleared":
      return { motionState: "INACTIVE" };
    case "camera.online":
      return { cameraState: "ONLINE", connectivity: "ONLINE" };
    case "camera.offline":
      return { cameraState: "OFFLINE", connectivity: "OFFLINE" };
    case "camera.recording":
      return { cameraState: "RECORDING" };
    case "device.online":
      return { connectivity: "ONLINE" };
    case "device.stale":
      return { connectivity: "STALE" };
    case "device.offline":
      return { connectivity: "OFFLINE" };
    default: {
      const exhaustiveCheck: never = event;
      throw new Error(`Unhandled event type: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}
