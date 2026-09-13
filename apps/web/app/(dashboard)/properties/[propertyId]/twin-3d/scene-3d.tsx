"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type DomainSelection, usePropertyStructure, useRealtimeStore } from "@homeguard/state";
import {
  type DeviceAnchorNode,
  type OpeningNode,
  type RoomNode,
  type StructuralModel,
  type WallSegmentNode,
  buildSceneGraph,
} from "@homeguard/three-adapter";
import { Bounds, Grid, OrbitControls } from "@react-three/drei";
import { Canvas, type ThreeEvent, useThree } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { type Group, type MeshStandardMaterial, Shape } from "three";
import type { TwinDeviceState } from "./types";

const ROOM_COLORS: Record<string, string> = {
  LIVING_ROOM: "#dbeafe",
  KITCHEN: "#fef3c7",
  BEDROOM: "#ede9fe",
  BATHROOM: "#cffafe",
  OFFICE: "#e0e7ff",
  HALLWAY: "#f5f5f4",
  GARAGE: "#e7e5e4",
  UTILITY: "#d1fae5",
  GARDEN: "#dcfce7",
  OTHER: "#e5e7eb",
};

function deviceColor(device: TwinDeviceState | undefined): string {
  if (!device) return "#a3a3a3";
  if (device.connectivity === "OFFLINE") return "#dc2626";
  if (device.motionState === "ACTIVE" || device.doorState === "OPEN") return "#f59e0b";
  if (device.lockState === "JAMMED") return "#dc2626";
  if (device.connectivity === "ONLINE") return "#10b981";
  return "#a3a3a3";
}

function formatDeviceState(device: TwinDeviceState): string {
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

function connectivityVariant(connectivity: string): "outline" | "secondary" | "destructive" {
  if (connectivity === "ONLINE") return "outline";
  if (connectivity === "OFFLINE") return "destructive";
  return "secondary";
}

const RoomSurface = memo(function RoomSurface({
  room,
  selected,
  onSelect,
}: {
  room: RoomNode;
  selected: boolean;
  onSelect: (selection: DomainSelection) => void;
}) {
  const shape = useMemo(() => {
    const nextShape = new Shape();
    const first = room.surface.points[0];
    if (!first) return nextShape;
    nextShape.moveTo(first.x, first.y);
    for (const point of room.surface.points.slice(1)) nextShape.lineTo(point.x, point.y);
    nextShape.closePath();
    return nextShape;
  }, [room.surface.points]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Three.js meshes cannot receive keyboard events; the adjacent Rooms list provides the equivalent keyboard path.
    <mesh
      position={room.surface.position}
      rotation={room.surface.rotation}
      receiveShadow
      userData={room.userData}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        onSelect({ id: room.id, type: "room" });
      }}
    >
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial
        color={selected ? "#93c5fd" : (ROOM_COLORS[room.kind] ?? "#e5e7eb")}
        roughness={0.9}
        side={2}
      />
    </mesh>
  );
});

const WallMesh = memo(function WallMesh({ wall }: { wall: WallSegmentNode }) {
  return (
    <mesh
      position={wall.mesh.position}
      rotation={wall.mesh.rotation}
      castShadow
      receiveShadow
      userData={wall.userData}
    >
      <boxGeometry args={wall.mesh.size} />
      <meshStandardMaterial color="#d6d3d1" roughness={0.82} />
    </mesh>
  );
});

const OpeningMesh = memo(function OpeningMesh({
  opening,
  device,
  selected,
  onSelect,
}: {
  opening: OpeningNode;
  device: TwinDeviceState | undefined;
  selected: boolean;
  onSelect: (selection: DomainSelection) => void;
}) {
  const groupRef = useRef<Group>(null);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (opening.type !== "door" || !groupRef.current) return;
    groupRef.current.rotation.y =
      opening.rotationY + (device?.doorState === "OPEN" ? -Math.PI / 2 : 0);
    invalidate();
  }, [device?.doorState, invalidate, opening.rotationY, opening.type]);

  if (opening.type === "door") {
    return (
      // biome-ignore lint/a11y/useKeyWithClickEvents: Three.js groups cannot receive keyboard events; openings are supplemental to the accessible room/device lists.
      <group
        ref={groupRef}
        position={opening.hinge}
        rotation={[0, opening.rotationY, 0]}
        userData={opening.userData}
        onClick={(event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation();
          onSelect({ id: opening.id, type: "door" });
        }}
      >
        <mesh position={[opening.width / 2, opening.height / 2, 0]} castShadow>
          <boxGeometry args={[opening.width * 0.96, opening.height * 0.96, 0.055]} />
          <meshStandardMaterial color={selected ? "#fbbf24" : "#a16207"} roughness={0.72} />
        </mesh>
      </group>
    );
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Three.js meshes cannot receive keyboard events; openings are supplemental to the accessible room/device lists.
    <mesh
      position={opening.center}
      rotation={[0, opening.rotationY, 0]}
      userData={opening.userData}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        onSelect({ id: opening.id, type: "window" });
      }}
    >
      <boxGeometry args={[opening.width * 0.96, opening.height * 0.92, 0.035]} />
      <meshPhysicalMaterial
        color={selected ? "#38bdf8" : "#bae6fd"}
        transparent
        opacity={0.58}
        roughness={0.08}
        metalness={0.05}
      />
    </mesh>
  );
});

const DeviceAnchor = memo(function DeviceAnchor({
  anchor,
  device,
  selected,
  onSelect,
}: {
  anchor: DeviceAnchorNode;
  device: TwinDeviceState | undefined;
  selected: boolean;
  onSelect: (selection: DomainSelection) => void;
}) {
  const groupRef = useRef<Group>(null);
  const materialRef = useRef<MeshStandardMaterial>(null);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    materialRef.current?.color.set(deviceColor(device));
    if (groupRef.current) {
      const scale = selected || device?.motionState === "ACTIVE" ? 1.3 : 1;
      groupRef.current.scale.setScalar(scale);
    }
    invalidate();
  }, [device, invalidate, selected]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Three.js groups cannot receive keyboard events; the adjacent Devices list provides the equivalent keyboard path.
    <group
      ref={groupRef}
      position={anchor.position}
      userData={anchor.userData}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        onSelect({ id: anchor.id, type: "device" });
      }}
    >
      <mesh castShadow>
        <sphereGeometry args={[0.18, 20, 16]} />
        <meshStandardMaterial
          ref={materialRef}
          color={deviceColor(device)}
          emissive={deviceColor(device)}
          emissiveIntensity={0.18}
          roughness={0.38}
        />
      </mesh>
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.09, 0.13, 0.18, 16]} />
        <meshStandardMaterial color="#404040" />
      </mesh>
    </group>
  );
});

function SceneContents({
  rooms,
  walls,
  openings,
  anchors,
  devicesById,
  selection,
  onSelect,
  boundsCenter,
  groundY,
}: {
  rooms: RoomNode[];
  walls: WallSegmentNode[];
  openings: OpeningNode[];
  anchors: DeviceAnchorNode[];
  devicesById: Map<string, TwinDeviceState>;
  selection: DomainSelection;
  onSelect: (selection: DomainSelection) => void;
  boundsCenter: [number, number, number];
  groundY: number;
}) {
  return (
    <>
      <color attach="background" args={["#f5f5f4"]} />
      <ambientLight intensity={1.15} />
      <directionalLight
        position={[8, 14, 10]}
        intensity={2.1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <hemisphereLight args={["#dbeafe", "#78716c", 0.75]} />

      <Bounds fit clip observe margin={1.22} maxDuration={0.65}>
        <group>
          {rooms.map((room) => (
            <RoomSurface
              key={room.id}
              room={room}
              selected={selection?.type === "room" && selection.id === room.id}
              onSelect={onSelect}
            />
          ))}
          {walls.map((wall) => (
            <WallMesh key={wall.id} wall={wall} />
          ))}
          {openings.map((opening) => (
            <OpeningMesh
              key={opening.id}
              opening={opening}
              device={opening.deviceId ? devicesById.get(opening.deviceId) : undefined}
              selected={selection?.id === opening.id}
              onSelect={onSelect}
            />
          ))}
          {anchors.map((anchor) => (
            <DeviceAnchor
              key={anchor.id}
              anchor={anchor}
              device={devicesById.get(anchor.id)}
              selected={selection?.type === "device" && selection.id === anchor.id}
              onSelect={onSelect}
            />
          ))}
        </group>
      </Bounds>

      <Grid
        position={[boundsCenter[0], groundY - 0.04, boundsCenter[2]]}
        args={[40, 40]}
        cellSize={0.5}
        cellThickness={0.4}
        cellColor="#d6d3d1"
        sectionSize={2}
        sectionThickness={0.75}
        sectionColor="#a8a29e"
        fadeDistance={35}
        infiniteGrid
      />
      <OrbitControls
        makeDefault
        target={boundsCenter}
        enableDamping
        dampingFactor={0.08}
        minDistance={2}
        maxDistance={80}
        maxPolarAngle={Math.PI / 2.02}
      />
    </>
  );
}

export function Scene3D({
  propertyId,
}: {
  propertyId: string;
}) {
  const structuralModel: StructuralModel = usePropertyStructure(propertyId);
  const realtime = useRealtimeStore((state) => state.properties[propertyId]);
  const select = useRealtimeStore((state) => state.select);
  const graph = useMemo(() => buildSceneGraph(structuralModel), [structuralModel]);
  const [activeFloorId, setActiveFloorId] = useState(graph.floors[0]?.id ?? "");
  const [showAllFloors, setShowAllFloors] = useState(graph.floors.length <= 1);
  const selection = realtime?.selected ?? null;
  const connectionState = realtime?.connectionState ?? "connecting";
  const lastEventAt = realtime?.lastEventAt ?? null;

  const devicesById = useMemo(() => {
    const result = new Map<string, TwinDeviceState>();
    for (const floor of structuralModel.floors) {
      for (const room of floor.rooms) {
        for (const device of room.devices) {
          const operational = realtime?.devicesById[device.id];
          if (operational)
            result.set(device.id, {
              ...operational,
              label: device.label,
              category: device.category,
            });
        }
      }
    }
    return result;
  }, [realtime?.devicesById, structuralModel.floors]);
  const visibleFloorIds = useMemo(
    () => new Set(showAllFloors ? graph.floors.map((floor) => floor.id) : [activeFloorId]),
    [activeFloorId, graph.floors, showAllFloors],
  );
  const visibleRooms = graph.rooms.filter((room) => visibleFloorIds.has(room.floorId));
  const visibleWalls = graph.walls.filter((wall) => visibleFloorIds.has(wall.floorId));
  const visibleOpenings = graph.openings.filter((opening) => visibleFloorIds.has(opening.floorId));
  const visibleAnchors = graph.deviceAnchors.filter((anchor) =>
    visibleFloorIds.has(anchor.floorId),
  );

  const selectedRoom =
    selection?.type === "room" ? graph.rooms.find((room) => room.id === selection.id) : undefined;
  const selectedOpening =
    selection?.type === "door" || selection?.type === "window"
      ? graph.openings.find((opening) => opening.id === selection.id)
      : undefined;
  const selectedDevice = selection?.type === "device" ? devicesById.get(selection.id) : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {graph.floors.map((floor) => (
            <Button
              key={floor.id}
              size="sm"
              variant={!showAllFloors && activeFloorId === floor.id ? "default" : "outline"}
              onClick={() => {
                setActiveFloorId(floor.id);
                setShowAllFloors(false);
                select(propertyId, null);
              }}
            >
              {floor.name}
            </Button>
          ))}
          {graph.floors.length > 1 && (
            <Button
              size="sm"
              variant={showAllFloors ? "default" : "outline"}
              onClick={() => {
                setShowAllFloors(true);
                select(propertyId, null);
              }}
            >
              Dollhouse
            </Button>
          )}
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

      <p className="text-xs text-neutral-500">
        Drag to orbit · scroll to zoom · right-drag to pan · select a room, opening, or device to
        inspect it.
      </p>

      <div className="flex flex-col gap-4 xl:flex-row">
        <div className="h-[34rem] min-w-0 flex-1 overflow-hidden rounded-lg border bg-stone-100 dark:bg-stone-900">
          <Canvas
            aria-label="Interactive 3D digital twin"
            role="img"
            shadows
            dpr={[1, 2]}
            frameloop="demand"
            camera={{ position: [10, 10, 10], fov: 42, near: 0.05, far: 250 }}
            onPointerMissed={() => select(propertyId, null)}
          >
            <SceneContents
              key={`${showAllFloors ? "all" : activeFloorId}:${visibleRooms.length}`}
              rooms={visibleRooms}
              walls={visibleWalls}
              openings={visibleOpenings}
              anchors={visibleAnchors}
              devicesById={devicesById}
              selection={selection}
              onSelect={(next) => select(propertyId, next)}
              boundsCenter={graph.bounds.center}
              groundY={graph.bounds.minY}
            />
          </Canvas>
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-3 xl:w-72" aria-label="3D selection">
          {selectedRoom && (
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{selectedRoom.name}</p>
              <p className="mt-1 text-xs text-neutral-500">
                {selectedRoom.kind.replaceAll("_", " ")}
              </p>
            </div>
          )}
          {selectedOpening && (
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium capitalize">{selectedOpening.type}</p>
              <p className="mt-1 text-xs text-neutral-500">
                {selectedOpening.isExterior ? "Exterior opening" : "Interior opening"}
                {selectedOpening.deviceId ? " · Linked sensor" : ""}
              </p>
            </div>
          )}
          {selectedDevice && (
            <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
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
              </p>
              <p className="text-xs text-neutral-600">{formatDeviceState(selectedDevice)}</p>
            </div>
          )}
          {!selection && (
            <p className="rounded-lg border border-dashed p-3 text-xs text-neutral-500">
              Nothing selected. The lists below provide a keyboard-accessible alternative to
              selecting objects directly in 3D.
            </p>
          )}

          <div className="rounded-lg border p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Rooms
            </p>
            <div className="flex flex-wrap gap-1.5">
              {visibleRooms.map((room) => (
                <Button
                  key={room.id}
                  size="sm"
                  variant={
                    selection?.type === "room" && selection.id === room.id ? "default" : "outline"
                  }
                  onClick={() => select(propertyId, { id: room.id, type: "room" })}
                >
                  {room.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Devices
            </p>
            <div className="flex flex-col gap-1">
              {visibleAnchors.map((anchor) => (
                <button
                  key={anchor.id}
                  type="button"
                  className="flex items-center gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => select(propertyId, { id: anchor.id, type: "device" })}
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: deviceColor(devicesById.get(anchor.id)) }}
                    aria-hidden="true"
                  />
                  {anchor.label}
                  {devicesById.get(anchor.id)?.source === "SIMULATION" ? " · SIM" : ""}
                </button>
              ))}
              {visibleAnchors.length === 0 && (
                <p className="text-xs text-neutral-500">No positioned room devices.</p>
              )}
            </div>
          </div>
        </aside>
      </div>

      {graph.warnings.length > 0 && (
        <details className="rounded-md border border-amber-300 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:text-amber-200">
          <summary>{graph.warnings.length} geometry warning(s)</summary>
          <ul className="mt-2 list-disc pl-5">
            {graph.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
