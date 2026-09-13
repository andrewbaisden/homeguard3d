export interface TwinDeviceState {
  id: string;
  label: string;
  category: string;
  connectivity: string;
  doorState: string | null;
  lockState: string | null;
  motionState: string | null;
  cameraState: string | null;
  batteryPct: number | null;
  tempC: number | null;
  humidityPct: number | null;
}
