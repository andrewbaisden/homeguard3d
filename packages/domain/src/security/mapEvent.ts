import type { DomainEvent } from "../events/schema";
import type { SecurityDomainEvent } from "./stateMachine";

/**
 * Maps a persisted DomainEvent to the SecurityDomainEvent shape
 * transition() consumes, or `null` if the event isn't security-related.
 * Both the realtime service (applying an event server-side) and any
 * client replaying the SSE stream call this same function — see
 * ARCHITECTURE.md section M ("one reducer, client and server").
 *
 * `security.arm_requested` always maps with `openHotZoneDeviceIds: []`:
 * a rejected arm attempt (blocked by the open-sensor guard) is never
 * persisted as an Event in the first place, so any persisted
 * arm_requested event is guaranteed to have already passed the guard —
 * replaying it with an empty list reproduces the same successful
 * transition regardless of the true historical list.
 */
export function mapToSecurityDomainEvent(event: DomainEvent): SecurityDomainEvent | null {
  switch (event.type) {
    case "security.arm_requested":
      return {
        type: "arm.requested",
        mode: event.metadata.mode,
        openHotZoneDeviceIds: [],
        override: event.metadata.override,
      };
    case "security.arm_cancelled":
      return { type: "arm.cancelled" };
    case "security.exit_delay_expired":
      return { type: "exit_delay.expired" };
    case "security.sensor_triggered":
      return {
        type: "sensor.triggered",
        deviceId: event.deviceId,
        isEntryPoint: event.metadata.isEntryPoint,
      };
    case "security.entry_delay_expired":
      return { type: "entry_delay.expired" };
    case "security.alert_grace_expired":
      return { type: "alert_grace.expired" };
    case "security.disarmed":
      return { type: "disarm.requested" };
    default:
      return null;
  }
}
