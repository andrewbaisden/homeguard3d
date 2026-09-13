"use client";

import { Badge } from "@/components/ui/badge";
import type { EventSource } from "@homeguard/domain";
import { useRealtimeStore } from "@homeguard/state";
import { Fragment } from "react";

export interface DeviceRow {
  id: string;
  label: string;
  category: string;
  provider: string;
  roomName: string | null;
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

function formatState(device: DeviceRow): string {
  const parts: string[] = [];
  if (device.doorState) parts.push(`Door ${device.doorState}`);
  if (device.lockState) parts.push(`Lock ${device.lockState}`);
  if (device.motionState) parts.push(`Motion ${device.motionState}`);
  if (device.cameraState) parts.push(`Camera ${device.cameraState}`);
  if (device.batteryPct != null) parts.push(`${device.batteryPct}% battery`);
  if (device.tempC != null) parts.push(`${device.tempC}°C`);
  if (device.humidityPct != null) parts.push(`${device.humidityPct}% humidity`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

function connectivityVariant(connectivity: string): "outline" | "secondary" | "destructive" {
  if (connectivity === "ONLINE") return "outline";
  if (connectivity === "OFFLINE") return "destructive";
  return "secondary";
}

/**
 * A plain table, not the 2D/3D view — but it already follows the real
 * architecture: the client applies incoming events through the exact
 * same pure reducer (`reduceDeviceEvent`) the realtime service uses at
 * ingestion, imported from @homeguard/domain. See ARCHITECTURE.md
 * section M. Operational state comes from the same normalized Zustand
 * records consumed by the 2D and 3D renderers.
 */
export function DeviceTable({
  propertyId,
  initialDevices,
}: {
  propertyId: string;
  initialDevices: DeviceRow[];
}) {
  const realtime = useRealtimeStore((state) => state.properties[propertyId]);
  const connectionState = realtime?.connectionState ?? "connecting";
  const devices = initialDevices.map((device) => ({
    ...device,
    ...(realtime?.devicesById[device.id] ?? {}),
  }));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-neutral-500">
        {connectionState === "open" && "Live"}
        {connectionState === "connecting" && "Connecting…"}
        {connectionState === "closed" && "Live updates disconnected — showing last known state."}
      </p>

      {devices.length === 0 ? (
        <p className="text-sm text-neutral-500">No devices yet. Add one below.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs text-neutral-500">
              <tr>
                <th className="px-3 py-2 font-medium">Label</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Room</th>
                <th className="px-3 py-2 font-medium">Connectivity</th>
                <th className="px-3 py-2 font-medium">State</th>
                <th className="px-3 py-2 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <Fragment key={device.id}>
                  <tr className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{device.label}</td>
                    <td className="px-3 py-2 text-neutral-600">
                      {device.category.replaceAll("_", " ")}
                    </td>
                    <td className="px-3 py-2 text-neutral-600">
                      {device.roomName ?? "Unassigned"}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={connectivityVariant(device.connectivity)}>
                        {device.connectivity}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-neutral-600">{formatState(device)}</td>
                    <td className="px-3 py-2 text-neutral-400">
                      {device.stateUpdatedAt
                        ? new Date(device.stateUpdatedAt).toLocaleTimeString()
                        : "—"}
                    </td>
                  </tr>
                  {device.source === "SIMULATION" && (
                    <tr className="border-b last:border-0">
                      <td className="px-3 pb-2 text-xs text-violet-700" colSpan={6}>
                        <Badge variant="secondary">SIMULATED</Badge> Latest state came from the
                        simulation provider.
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
