"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type Point,
  type StructuralFloor,
  boundsOfPolygons,
  fallbackDevicePosition,
  polygonCentroid,
  wallOffsetSpan,
} from "@homeguard/domain";
import {
  type DeviceOperationalState,
  usePropertyStructure,
  useRealtimeStore,
  useUpdateDevicePosition,
} from "@homeguard/state";
import { Fragment, useMemo, useRef, useState } from "react";
import { setDevicePosition } from "./actions";

export type DeviceMarker = StructuralFloor["rooms"][number]["devices"][number] &
  DeviceOperationalState;

function formatState(device: DeviceMarker): string {
  const parts: string[] = [];
  if (device.doorState) parts.push(`Door ${device.doorState}`);
  if (device.lockState) parts.push(`Lock ${device.lockState}`);
  if (device.motionState) parts.push(`Motion ${device.motionState}`);
  if (device.cameraState) parts.push(`Camera ${device.cameraState}`);
  if (device.batteryPct != null) parts.push(`${device.batteryPct}% battery`);
  if (device.tempC != null) parts.push(`${device.tempC}°C`);
  if (device.humidityPct != null) parts.push(`${device.humidityPct}% humidity`);
  return parts.length > 0 ? parts.join(" · ") : "No state yet";
}

function markerClassName(device: DeviceMarker): string {
  if (device.connectivity === "OFFLINE") return "fill-destructive stroke-white";
  if (device.motionState === "ACTIVE" || device.doorState === "OPEN") {
    return "fill-amber-500 stroke-white";
  }
  if (device.connectivity === "ONLINE") return "fill-emerald-500 stroke-white";
  return "fill-neutral-400 stroke-white";
}

function connectivityVariant(connectivity: string): "outline" | "secondary" | "destructive" {
  if (connectivity === "ONLINE") return "outline";
  if (connectivity === "OFFLINE") return "destructive";
  return "secondary";
}

function clientPointToSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): Point {
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const transformed = point.matrixTransform(ctm.inverse());
  return { x: transformed.x, y: transformed.y };
}

/**
 * The 2D floor plan — an SVG rendered directly from structural geometry
 * (Room.polygon, Door/Window wallOffset) plus live operational state
 * from the property layout's single SSE-backed Zustand store. Structural
 * data comes from the same TanStack Query entry the 3D route consumes.
 */
export function FloorPlanCanvas({
  propertyId,
  canEdit = false,
}: {
  propertyId: string;
  canEdit?: boolean;
}) {
  const structure = usePropertyStructure(propertyId);
  const realtime = useRealtimeStore((state) => state.properties[propertyId]);
  const select = useRealtimeStore((state) => state.select);
  const updateCachedPosition = useUpdateDevicePosition(propertyId);
  const floors = structure.floors;
  const [activeFloorId, setActiveFloorId] = useState(floors[0]?.id ?? "");
  const [placingDeviceId, setPlacingDeviceId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const selection = realtime?.selected ?? null;
  const connectionState = realtime?.connectionState ?? "connecting";
  const lastEventAt = realtime?.lastEventAt ?? null;
  const devicesById = realtime?.devicesById ?? {};

  const activeFloor = floors.find((floor) => floor.id === activeFloorId) ?? floors[0];

  const roomsWithLiveDevices = useMemo(() => {
    if (!activeFloor) return [];
    return activeFloor.rooms.map((room) => ({
      ...room,
      devices: room.devices.flatMap((device) => {
        const operational = devicesById[device.id];
        return operational ? [{ ...device, ...operational }] : [];
      }),
    }));
  }, [activeFloor, devicesById]);

  const bounds = useMemo(
    () => boundsOfPolygons(roomsWithLiveDevices.map((room) => room.polygon)),
    [roomsWithLiveDevices],
  );
  const padding = 1;
  const viewBox = `${bounds.minX - padding} ${bounds.minY - padding} ${
    bounds.maxX - bounds.minX + padding * 2
  } ${bounds.maxY - bounds.minY + padding * 2}`;

  const selectedRoom =
    selection?.type === "room" ? roomsWithLiveDevices.find((r) => r.id === selection.id) : null;
  const selectedDevice =
    selection?.type === "device"
      ? roomsWithLiveDevices.flatMap((room) => room.devices).find((d) => d.id === selection.id)
      : null;
  const selectedDeviceRoom = selectedDevice
    ? roomsWithLiveDevices.find((r) => r.id === selectedDevice.roomId)
    : null;

  async function handleCanvasClick(event: React.MouseEvent<SVGSVGElement>) {
    if (!placingDeviceId || !svgRef.current) return;
    const point = clientPointToSvgPoint(svgRef.current, event.clientX, event.clientY);
    setPlacingDeviceId(null);
    updateCachedPosition(placingDeviceId, point.x, point.y);
    await setDevicePosition(propertyId, { deviceId: placingDeviceId, x: point.x, y: point.y });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {floors.map((floor) => (
            <Button
              key={floor.id}
              size="sm"
              variant={floor.id === activeFloor?.id ? "default" : "outline"}
              onClick={() => {
                setActiveFloorId(floor.id);
                select(propertyId, null);
                setPlacingDeviceId(null);
              }}
            >
              {floor.name}
            </Button>
          ))}
        </div>
        <p className="text-xs text-neutral-500" aria-live="polite">
          {connectionState === "open" && "Live"}
          {connectionState === "connecting" && "Connecting to live updates…"}
          {connectionState === "closed" && (
            <>
              Live updates disconnected — showing last known state
              {lastEventAt ? ` as of ${new Date(lastEventAt).toLocaleTimeString()}` : ""}.
            </>
          )}
        </p>
      </div>

      {placingDeviceId && (
        <p className="rounded-md border border-dashed p-2 text-xs text-neutral-500">
          Click anywhere on the plan to place this device.{" "}
          <button type="button" className="underline" onClick={() => setPlacingDeviceId(null)}>
            Cancel
          </button>
        </p>
      )}

      <div className="flex flex-col gap-4 md:flex-row">
        <div className="min-w-0 flex-1 rounded-lg border bg-card p-2">
          {/*
            biome-ignore lint/a11y/useKeyWithClickEvents: this click only
            matters in "placing a device" mode, where it means "pick this
            point in 2D space" — there's no meaningful keyboard equivalent
            for that, and a text Cancel button (below) is always reachable.
            The floor plan is a supplementary visual view, not the only way
            to reach this data — see AGENTS.md / ARCHITECTURE.md section
            76: the Devices and property pages already provide a fully
            accessible equivalent.
          */}
          <svg
            ref={svgRef}
            viewBox={viewBox}
            className="h-auto w-full"
            style={{
              aspectRatio: `${bounds.maxX - bounds.minX + padding * 2} / ${
                bounds.maxY - bounds.minY + padding * 2
              }`,
            }}
            onClick={handleCanvasClick}
            role="img"
            aria-label={`${activeFloor?.name ?? "Floor"} plan`}
          >
            {roomsWithLiveDevices.map((room) => {
              const points = room.polygon.map((p) => `${p.x},${p.y}`).join(" ");
              const isSelected = selection?.type === "room" && selection.id === room.id;
              const centroid = polygonCentroid(room.polygon);

              return (
                <g key={room.id}>
                  <polygon
                    points={points}
                    className={
                      isSelected
                        ? "cursor-pointer fill-primary/10 stroke-primary outline-none"
                        : "cursor-pointer fill-muted stroke-neutral-400 outline-none hover:fill-muted/70"
                    }
                    strokeWidth={0.08}
                    tabIndex={placingDeviceId ? -1 : 0}
                    // biome-ignore lint/a11y/useSemanticElements: an SVG <polygon> can't be a real <button>.
                    role="button"
                    aria-label={`Select ${room.name}`}
                    onClick={(event) => {
                      if (placingDeviceId) return;
                      event.stopPropagation();
                      select(propertyId, { type: "room", id: room.id });
                    }}
                    onKeyDown={(event) => {
                      if (placingDeviceId) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        select(propertyId, { type: "room", id: room.id });
                      }
                    }}
                  >
                    <title>{room.name}</title>
                  </polygon>

                  <text
                    x={centroid.x}
                    y={centroid.y}
                    fontSize={0.28}
                    textAnchor="middle"
                    className="pointer-events-none fill-neutral-500"
                  >
                    {room.name}
                  </text>

                  {room.doors.map((door) => {
                    const [from, to] = wallOffsetSpan(room.polygon, door.wallOffset);
                    return (
                      <line
                        key={door.id}
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        className="stroke-amber-600"
                        strokeWidth={0.16}
                        strokeLinecap="round"
                      >
                        <title>Door · {door.isExterior ? "exterior" : "interior"}</title>
                      </line>
                    );
                  })}

                  {room.windows.map((win) => {
                    const [from, to] = wallOffsetSpan(room.polygon, win.wallOffset);
                    return (
                      <line
                        key={win.id}
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        className="stroke-sky-500"
                        strokeWidth={0.14}
                        strokeLinecap="round"
                      >
                        <title>Window</title>
                      </line>
                    );
                  })}

                  {room.devices.map((device, index) => {
                    const position =
                      device.positionX != null && device.positionY != null
                        ? { x: device.positionX, y: device.positionY }
                        : fallbackDevicePosition(room.polygon, index);
                    const isDeviceSelected =
                      selection?.type === "device" && selection.id === device.id;

                    return (
                      <Fragment key={device.id}>
                        <circle
                          key={device.id}
                          cx={position.x}
                          cy={position.y}
                          r={isDeviceSelected ? 0.32 : 0.25}
                          strokeWidth={0.05}
                          className={`cursor-pointer outline-none ${markerClassName(device)}`}
                          tabIndex={placingDeviceId ? -1 : 0}
                          // biome-ignore lint/a11y/useSemanticElements: an SVG <circle> can't be a real <button>.
                          role="button"
                          aria-label={`Select ${device.label}`}
                          onClick={(event) => {
                            if (placingDeviceId) return;
                            event.stopPropagation();
                            select(propertyId, { type: "device", id: device.id });
                          }}
                          onKeyDown={(event) => {
                            if (placingDeviceId) return;
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              event.stopPropagation();
                              select(propertyId, { type: "device", id: device.id });
                            }
                          }}
                        >
                          <title>
                            {device.label} · {device.connectivity}
                            {device.source === "SIMULATION" ? " · SIMULATED" : ""}
                          </title>
                        </circle>
                        {device.source === "SIMULATION" && (
                          <text
                            x={position.x}
                            y={position.y - 0.38}
                            fontSize={0.16}
                            textAnchor="middle"
                            className="pointer-events-none fill-violet-700"
                          >
                            SIM
                          </text>
                        )}
                      </Fragment>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="w-full shrink-0 md:w-64">
          {selectedRoom && (
            <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
              <p className="font-medium">{selectedRoom.name}</p>
              <p className="text-xs text-neutral-500">{selectedRoom.kind.replaceAll("_", " ")}</p>
              <p className="text-xs text-neutral-500">
                {selectedRoom.doors.length} door(s) · {selectedRoom.windows.length} window(s) ·{" "}
                {selectedRoom.devices.length} device(s)
              </p>
              {selectedRoom.devices.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {selectedRoom.devices.map((device) => (
                    <li key={device.id}>
                      <button
                        type="button"
                        className="text-left text-xs underline"
                        onClick={() => select(propertyId, { type: "device", id: device.id })}
                      >
                        {device.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {selectedDevice && (
            <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium">{selectedDevice.label}</p>
                <Badge variant={connectivityVariant(selectedDevice.connectivity)}>
                  {selectedDevice.connectivity}
                </Badge>
              </div>
              {selectedDevice.source === "SIMULATION" && (
                <Badge variant="secondary" className="w-fit">
                  SIMULATED
                </Badge>
              )}
              <p className="text-xs text-neutral-500">
                {selectedDevice.category.replaceAll("_", " ")}
                {selectedDeviceRoom ? ` · ${selectedDeviceRoom.name}` : ""}
              </p>
              <p className="text-xs text-neutral-600">{formatState(selectedDevice)}</p>
              {selectedDevice.capabilities.length > 0 && (
                <p className="text-xs text-neutral-500">{selectedDevice.capabilities.join(", ")}</p>
              )}
              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPlacingDeviceId(selectedDevice.id)}
                >
                  {selectedDevice.positionX != null ? "Move on map" : "Place on map"}
                </Button>
              )}
            </div>
          )}

          {!selectedRoom && !selectedDevice && (
            <p className="rounded-lg border border-dashed p-3 text-xs text-neutral-500">
              Select a room or device on the plan to see details here.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
