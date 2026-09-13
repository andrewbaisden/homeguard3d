/**
 * The security state machine — see ARCHITECTURE.md section E and
 * DECISIONS.md ADR-009. This is the single "never change without
 * tests" boundary called out in AGENTS.md: every transition and guard
 * lives in this one pure module, with no I/O and no Prisma import.
 * Callers (the realtime service's ingestion handler) gather whatever
 * context a transition needs (zone snapshots, timer scheduling) and
 * apply the returned effects — this module only decides.
 */

export type SecurityMode = "DISARMED" | "HOME" | "NIGHT" | "AWAY";

export type SecurityMachineState =
  | "IDLE_DISARMED"
  | "EXIT_DELAY"
  | "ARMED"
  | "ENTRY_DELAY"
  | "ALERT"
  | "ALARM"
  | "DISARMING";

export const EXIT_DELAY_MS = 30_000;
export const ENTRY_DELAY_MS = 30_000;
export const ALERT_GRACE_MS = 20_000;

export interface SecurityStateSnapshot {
  machineState: SecurityMachineState;
  mode: SecurityMode;
}

/**
 * Inputs the pure transition function accepts. `sensor.triggered` is
 * never posted by a client directly — the ingestion handler derives it
 * from an already-persisted device event (e.g. door.opened) once it
 * notices the property is ARMED and the device sits in a zone that's
 * hot for the current mode. See ARCHITECTURE.md section F for the
 * "entry point" heuristic (a triggering device linked to an exterior
 * Door gets the entry delay; anything else — motion sensors, interior
 * doors — goes straight to ALERT).
 */
export type SecurityDomainEvent =
  | { type: "arm.requested"; mode: SecurityMode; openHotZoneDeviceIds: string[]; override: boolean }
  | { type: "arm.cancelled" }
  | { type: "exit_delay.expired" }
  | { type: "sensor.triggered"; deviceId: string; isEntryPoint: boolean }
  | { type: "entry_delay.expired" }
  | { type: "alert_grace.expired" }
  | { type: "disarm.requested" };

export type SecurityEffect =
  | { kind: "SCHEDULE_TIMER"; timer: "EXIT_DELAY" | "ENTRY_DELAY" | "ALERT_GRACE"; delayMs: number }
  | { kind: "CANCEL_TIMERS" }
  | { kind: "RAISE_ALARM" }
  | { kind: "CLEAR_ALARM" };

export interface TransitionResult {
  next: SecurityStateSnapshot;
  effects: SecurityEffect[];
  /** Set when `arm.requested` is blocked by the open-sensor guard. */
  rejected?: { reason: "OPEN_HOT_ZONE_DEVICES"; deviceIds: string[] };
}

function unchanged(current: SecurityStateSnapshot): TransitionResult {
  return { next: current, effects: [] };
}

/**
 * `transition(current, event) -> { next, effects }`. Events that don't
 * apply to the current state are no-ops (unchanged state, no effects)
 * rather than errors — a realtime system will always see some
 * messages arrive "too late" (e.g. a cancel after exit delay already
 * expired), and silently ignoring them is the correct, idempotent
 * behavior for a synchronous reducer.
 */
export function transition(
  current: SecurityStateSnapshot,
  event: SecurityDomainEvent,
): TransitionResult {
  switch (current.machineState) {
    case "IDLE_DISARMED": {
      if (event.type !== "arm.requested") return unchanged(current);

      if (event.openHotZoneDeviceIds.length > 0 && !event.override) {
        return {
          next: current,
          effects: [],
          rejected: { reason: "OPEN_HOT_ZONE_DEVICES", deviceIds: event.openHotZoneDeviceIds },
        };
      }

      return {
        next: { machineState: "EXIT_DELAY", mode: event.mode },
        effects: [{ kind: "SCHEDULE_TIMER", timer: "EXIT_DELAY", delayMs: EXIT_DELAY_MS }],
      };
    }

    case "EXIT_DELAY": {
      if (event.type === "exit_delay.expired") {
        return { next: { machineState: "ARMED", mode: current.mode }, effects: [] };
      }
      if (event.type === "arm.cancelled") {
        return {
          next: { machineState: "IDLE_DISARMED", mode: "DISARMED" },
          effects: [{ kind: "CANCEL_TIMERS" }],
        };
      }
      return unchanged(current);
    }

    case "ARMED": {
      if (event.type === "sensor.triggered") {
        if (event.isEntryPoint) {
          return {
            next: { machineState: "ENTRY_DELAY", mode: current.mode },
            effects: [{ kind: "SCHEDULE_TIMER", timer: "ENTRY_DELAY", delayMs: ENTRY_DELAY_MS }],
          };
        }
        return {
          next: { machineState: "ALERT", mode: current.mode },
          effects: [{ kind: "SCHEDULE_TIMER", timer: "ALERT_GRACE", delayMs: ALERT_GRACE_MS }],
        };
      }
      if (event.type === "disarm.requested") {
        return {
          next: { machineState: "IDLE_DISARMED", mode: "DISARMED" },
          effects: [{ kind: "CANCEL_TIMERS" }],
        };
      }
      return unchanged(current);
    }

    case "ENTRY_DELAY": {
      if (event.type === "entry_delay.expired") {
        return {
          next: { machineState: "ALARM", mode: current.mode },
          effects: [{ kind: "RAISE_ALARM" }],
        };
      }
      if (event.type === "disarm.requested") {
        return {
          next: { machineState: "IDLE_DISARMED", mode: "DISARMED" },
          effects: [{ kind: "CANCEL_TIMERS" }],
        };
      }
      return unchanged(current);
    }

    case "ALERT": {
      if (event.type === "alert_grace.expired") {
        return {
          next: { machineState: "ALARM", mode: current.mode },
          effects: [{ kind: "RAISE_ALARM" }],
        };
      }
      if (event.type === "disarm.requested") {
        return {
          next: { machineState: "IDLE_DISARMED", mode: "DISARMED" },
          effects: [{ kind: "CANCEL_TIMERS" }],
        };
      }
      return unchanged(current);
    }

    case "ALARM": {
      // Always allowed — never lock a user out of disarming their own alarm.
      if (event.type === "disarm.requested") {
        return {
          next: { machineState: "IDLE_DISARMED", mode: "DISARMED" },
          effects: [{ kind: "CLEAR_ALARM" }],
        };
      }
      return unchanged(current);
    }

    case "DISARMING": {
      // Not currently produced by any transition below — reserved for a
      // future async disarm flow (e.g. two-factor confirmation) that
      // needs a real intermediate persisted state. Treat as a pass-through
      // to IDLE_DISARMED so the type stays exhaustive-safe if something
      // upstream ever puts a property in this state.
      return { next: { machineState: "IDLE_DISARMED", mode: "DISARMED" }, effects: [] };
    }

    default: {
      const exhaustiveCheck: never = current.machineState;
      throw new Error(`Unhandled security machine state: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}
