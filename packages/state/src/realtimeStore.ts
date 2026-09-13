import {
  type DomainEvent,
  type EventSource,
  type SecurityStateSnapshot,
  isDeviceStateEvent,
  mapToSecurityDomainEvent,
  reduceDeviceEvent,
  transition,
} from "@homeguard/domain";
import { create } from "zustand";

export interface DeviceOperationalState {
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

export interface SecurityOperationalState extends SecurityStateSnapshot {
  changedAt: string;
  source: EventSource | null;
}

export type RealtimeConnectionState = "connecting" | "open" | "closed";
export type DomainSelection = {
  id: string;
  type: "room" | "door" | "window" | "device";
} | null;

export interface PropertyRealtimeState {
  devicesById: Record<string, DeviceOperationalState>;
  security: SecurityOperationalState;
  selected: DomainSelection;
  connectionState: RealtimeConnectionState;
  lastEventAt: string | null;
  seenEventIds: string[];
}

export interface OperationalSnapshot {
  devices: DeviceOperationalState[];
  security: SecurityOperationalState;
}

const EMPTY_SECURITY: SecurityOperationalState = {
  machineState: "IDLE_DISARMED",
  mode: "DISARMED",
  changedAt: new Date(0).toISOString(),
  source: null,
};

function newerOrEqual(incoming: string | null, existing: string | null): boolean {
  if (!existing) return true;
  if (!incoming) return false;
  return Date.parse(incoming) >= Date.parse(existing);
}

export function mergeOperationalSnapshot(
  current: PropertyRealtimeState | undefined,
  snapshot: OperationalSnapshot,
): PropertyRealtimeState {
  const devicesById = { ...(current?.devicesById ?? {}) };
  for (const device of snapshot.devices) {
    const existing = devicesById[device.id];
    if (!existing || newerOrEqual(device.stateUpdatedAt, existing.stateUpdatedAt)) {
      devicesById[device.id] = device;
    }
  }
  const security =
    !current || newerOrEqual(snapshot.security.changedAt, current.security.changedAt)
      ? snapshot.security
      : current.security;

  return {
    devicesById,
    security,
    selected: current?.selected ?? null,
    connectionState: current?.connectionState ?? "connecting",
    lastEventAt: current?.lastEventAt ?? null,
    seenEventIds: current?.seenEventIds ?? [],
  };
}

export function projectRealtimeEvent(
  current: PropertyRealtimeState,
  event: DomainEvent,
): PropertyRealtimeState {
  if (current.seenEventIds.includes(event.eventId)) return current;
  const seenEventIds = [...current.seenEventIds.slice(-255), event.eventId];
  const base = { ...current, seenEventIds, lastEventAt: event.occurredAt };

  if (isDeviceStateEvent(event)) {
    const device = current.devicesById[event.deviceId];
    if (!device) return base;
    return {
      ...base,
      devicesById: {
        ...current.devicesById,
        [event.deviceId]: {
          ...device,
          ...reduceDeviceEvent(event),
          stateUpdatedAt: event.occurredAt,
          source: event.source,
        },
      },
    };
  }

  const securityEvent = mapToSecurityDomainEvent(event);
  if (!securityEvent) return base;
  const next = transition(current.security, securityEvent).next;
  return {
    ...base,
    security: {
      ...next,
      changedAt: event.occurredAt,
      source: event.source,
    },
  };
}

interface RealtimeStore {
  properties: Record<string, PropertyRealtimeState>;
  hydrate: (propertyId: string, snapshot: OperationalSnapshot) => void;
  applyEvent: (propertyId: string, event: DomainEvent) => void;
  setConnection: (propertyId: string, state: RealtimeConnectionState) => void;
  select: (propertyId: string, selection: DomainSelection) => void;
}

export const useRealtimeStore = create<RealtimeStore>((set) => ({
  properties: {},
  hydrate: (propertyId, snapshot) =>
    set((state) => ({
      properties: {
        ...state.properties,
        [propertyId]: mergeOperationalSnapshot(state.properties[propertyId], snapshot),
      },
    })),
  applyEvent: (propertyId, event) =>
    set((state) => {
      const current = state.properties[propertyId];
      if (!current) return state;
      return {
        properties: { ...state.properties, [propertyId]: projectRealtimeEvent(current, event) },
      };
    }),
  setConnection: (propertyId, connectionState) =>
    set((state) => {
      const current = state.properties[propertyId];
      if (!current) return state;
      return {
        properties: {
          ...state.properties,
          [propertyId]: { ...current, connectionState },
        },
      };
    }),
  select: (propertyId, selected) =>
    set((state) => {
      const current = state.properties[propertyId];
      if (!current) return state;
      return {
        properties: { ...state.properties, [propertyId]: { ...current, selected } },
      };
    }),
}));

export function emptyOperationalSnapshot(): OperationalSnapshot {
  return { devices: [], security: EMPTY_SECURITY };
}
