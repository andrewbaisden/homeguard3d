"use client";

import { Badge } from "@/components/ui/badge";
import { domainEventSchema, isDeviceStateEvent, reduceDeviceEvent } from "@homeguard/domain";
import { useEffect, useState } from "react";

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

type ConnectionState = "connecting" | "open" | "closed";

/**
 * A plain table, not the 2D/3D view — but it already follows the real
 * architecture: the client applies incoming events through the exact
 * same pure reducer (`reduceDeviceEvent`) the realtime service uses at
 * ingestion, imported from @homeguard/domain. See ARCHITECTURE.md
 * section M. The full Zustand-backed store lands in Phase 8; this
 * component's local state is this page's own scoped equivalent.
 */
export function DeviceTable({
  propertyId,
  initialDevices,
  sseBaseUrl,
}: {
  propertyId: string;
  initialDevices: DeviceRow[];
  sseBaseUrl: string;
}) {
  const [devices, setDevices] = useState(initialDevices);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");

  // initialDevices is a new array every time the server re-renders this
  // route (e.g. a server action's revalidatePath after adding a device).
  // useState's initializer only runs once, so without this the table
  // would keep showing whatever was on the page at first mount.
  useEffect(() => {
    setDevices(initialDevices);
  }, [initialDevices]);

  useEffect(() => {
    const source = new EventSource(`${sseBaseUrl}/realtime/${propertyId}/stream`);

    source.onopen = () => setConnectionState("open");
    source.onerror = () => setConnectionState("closed");

    source.onmessage = (message) => {
      let raw: unknown;
      try {
        raw = JSON.parse(message.data);
      } catch {
        return;
      }

      const parsed = domainEventSchema.safeParse(raw);
      if (!parsed.success || !isDeviceStateEvent(parsed.data)) {
        return;
      }
      const event = parsed.data;
      const patch = reduceDeviceEvent(event);

      setDevices((prev) =>
        prev.map((device) =>
          device.id === event.deviceId
            ? { ...device, ...patch, stateUpdatedAt: event.occurredAt }
            : device,
        ),
      );
    };

    return () => source.close();
  }, [propertyId, sseBaseUrl]);

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
                <tr key={device.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{device.label}</td>
                  <td className="px-3 py-2 text-neutral-600">
                    {device.category.replaceAll("_", " ")}
                  </td>
                  <td className="px-3 py-2 text-neutral-600">{device.roomName ?? "Unassigned"}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
