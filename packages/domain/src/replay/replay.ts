import { isDeviceStateEvent, reduceDeviceEvent } from "../devices/reducer";
import type { DomainEvent, EventSource } from "../events/schema";
import { mapToSecurityDomainEvent } from "../security/mapEvent";
import type { SecurityMachineState, SecurityMode } from "../security/stateMachine";
import { transition } from "../security/stateMachine";

export interface ReplayDeviceState {
  id: string;
  connectivity: string;
  doorState: string | null;
  lockState: string | null;
  motionState: string | null;
  cameraState: string | null;
  batteryPct: number | null;
  tempC: number | null;
  humidityPct: number | null;
  stateUpdatedAt: string | null;
  source: EventSource | null;
}

export interface ReplaySecurityState {
  machineState: SecurityMachineState;
  mode: SecurityMode;
  changedAt: string;
  source: EventSource | null;
}

export interface ReplayState {
  devicesById: Record<string, ReplayDeviceState>;
  security: ReplaySecurityState;
}

/**
 * Fold events after a snapshot through the same pure reducers used at
 * live ingestion (ARCHITECTURE.md §Q / ADR-015).
 */
export function replayToTime(base: ReplayState, events: DomainEvent[]): ReplayState {
  let state = {
    devicesById: { ...base.devicesById },
    security: { ...base.security },
  };

  const ordered = [...events].sort(
    (left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt),
  );

  for (const event of ordered) {
    if (isDeviceStateEvent(event)) {
      const device = state.devicesById[event.deviceId];
      if (!device) continue;
      state = {
        ...state,
        devicesById: {
          ...state.devicesById,
          [event.deviceId]: {
            ...device,
            ...reduceDeviceEvent(event),
            stateUpdatedAt: event.occurredAt,
            source: event.source,
          },
        },
      };
      continue;
    }

    const securityEvent = mapToSecurityDomainEvent(event);
    if (!securityEvent) continue;
    const next = transition(state.security, securityEvent).next;
    state = {
      ...state,
      security: {
        ...next,
        changedAt: event.occurredAt,
        source: event.source,
      },
    };
  }

  return state;
}
