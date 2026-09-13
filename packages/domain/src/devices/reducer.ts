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
 * The subset of DomainEvent that actually changes Device columns.
 * Security events (Phase 5) are property- or sensor-trigger-scoped and
 * never flow through this reducer — the realtime service's ingestion
 * handler narrows to this type before calling reduceDeviceEvent, and
 * routes security.* events to packages/domain/src/security/stateMachine.ts
 * instead. Keeping this a narrower type (rather than widening the
 * switch below with no-op cases) preserves the exhaustiveness check's
 * value: a new *device* event type without a case here is still a
 * compile error.
 */
export type DeviceStateEvent = Extract<
  DomainEvent,
  {
    type:
      | "door.opened"
      | "door.closed"
      | "lock.locked"
      | "lock.unlocked"
      | "lock.jammed"
      | "motion.started"
      | "motion.cleared"
      | "camera.online"
      | "camera.offline"
      | "camera.recording"
      | "device.online"
      | "device.stale"
      | "device.offline";
  }
>;

/**
 * Pure reducer: given a device-scoped domain event, returns the patch
 * to apply to that device's operational-state columns. No I/O — the
 * caller (apps/realtime-service ingestion handler) applies the patch
 * inside the same transaction as the Event insert. See
 * ARCHITECTURE.md section H and AGENTS.md rule #2 ("never change
 * without tests").
 *
 * The `never` case in `default` is a compile-time guarantee: adding a
 * new device event type to the schema without a corresponding case
 * here is a type error, not a silent no-op.
 */
export function reduceDeviceEvent(event: DeviceStateEvent): DeviceStatePatch {
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

const DEVICE_STATE_EVENT_TYPES = new Set<DeviceStateEvent["type"]>([
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
]);

/** Narrows a DomainEvent to DeviceStateEvent — see that type's doc comment. */
export function isDeviceStateEvent(event: DomainEvent): event is DeviceStateEvent {
  return DEVICE_STATE_EVENT_TYPES.has(event.type as DeviceStateEvent["type"]);
}
