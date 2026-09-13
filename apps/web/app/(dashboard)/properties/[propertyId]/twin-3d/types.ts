import type { DeviceOperationalState } from "@homeguard/state";

export interface TwinDeviceState extends DeviceOperationalState {
  label: string;
  category: string;
}
