import {
  type Point,
  type WallOffset,
  boundsOfPolygons,
  fallbackDevicePosition,
  pointAlongSegment,
  wallSegmentEndpoints,
} from "@homeguard/domain";

export const DEFAULT_ROOM_HEIGHT_METERS = 2.7;
export const FLOOR_LEVEL_HEIGHT_METERS = 3.2;
export const FLOOR_THICKNESS_METERS = 0.08;
export const WALL_THICKNESS_METERS = 0.12;

const DOOR_HEIGHT_METERS = 2.1;
const WINDOW_BOTTOM_METERS = 0.9;
const WINDOW_HEIGHT_METERS = 1.2;
const EPSILON = 1e-6;

export type Vector3Tuple = [number, number, number];
export type EulerTuple = [number, number, number];

export interface DomainUserData {
  domainId: string;
  domainType: "property" | "floor" | "room" | "door" | "window" | "device";
}

export interface StructuralDevice {
  id: string;
  label: string;
  category: string;
  roomId: string | null;
  positionX: number | null;
  positionY: number | null;
}

export interface StructuralOpening {
  id: string;
  wallOffset: WallOffset;
  deviceId: string | null;
}

export interface StructuralDoor extends StructuralOpening {
  isExterior: boolean;
}

export interface StructuralRoom {
  id: string;
  name: string;
  kind: string;
  polygon: Point[];
  doors: StructuralDoor[];
  windows: StructuralOpening[];
  devices: StructuralDevice[];
}

export interface StructuralFloor {
  id: string;
  name: string;
  level: number;
  rooms: StructuralRoom[];
}

export interface StructuralModel {
  propertyId: string;
  floors: StructuralFloor[];
}

export interface FloorNode {
  id: string;
  name: string;
  level: number;
  elevation: number;
  userData: DomainUserData;
}

export interface ShapeMeshDescriptor {
  kind: "shape";
  points: Point[];
  position: Vector3Tuple;
  rotation: EulerTuple;
}

export interface BoxMeshDescriptor {
  kind: "box";
  size: Vector3Tuple;
  position: Vector3Tuple;
  rotation: EulerTuple;
}

export interface RoomNode {
  id: string;
  floorId: string;
  name: string;
  kind: string;
  elevation: number;
  surface: ShapeMeshDescriptor;
  userData: DomainUserData;
}

export interface WallSegmentNode {
  id: string;
  roomId: string;
  floorId: string;
  mesh: BoxMeshDescriptor;
  userData: DomainUserData;
}

export interface OpeningNode {
  id: string;
  type: "door" | "window";
  roomId: string;
  floorId: string;
  deviceId: string | null;
  width: number;
  height: number;
  bottom: number;
  hinge: Vector3Tuple;
  center: Vector3Tuple;
  rotationY: number;
  isExterior: boolean;
  userData: DomainUserData;
}

export interface DeviceAnchorNode {
  id: string;
  label: string;
  category: string;
  roomId: string;
  floorId: string;
  position: Vector3Tuple;
  userData: DomainUserData;
}

export interface SceneBounds {
  center: Vector3Tuple;
  size: Vector3Tuple;
  minY: number;
  maxY: number;
}

export interface SceneGraph {
  property: { id: string; userData: DomainUserData };
  floors: FloorNode[];
  rooms: RoomNode[];
  walls: WallSegmentNode[];
  openings: OpeningNode[];
  deviceAnchors: DeviceAnchorNode[];
  bounds: SceneBounds;
  warnings: string[];
}

interface CandidateOpening {
  id: string;
  type: "door" | "window";
  offset: WallOffset;
  deviceId: string | null;
  isExterior: boolean;
}

function isFinitePoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function toWorld(point: Point, y: number): Vector3Tuple {
  return [point.x, y, -point.y];
}

function addWallPiece(
  target: WallSegmentNode[],
  room: StructuralRoom,
  floor: StructuralFloor,
  segmentIndex: number,
  from: Point,
  to: Point,
  start: number,
  end: number,
  bottom: number,
  top: number,
  pieceIndex: number,
): void {
  const width = end - start;
  const height = top - bottom;
  if (width <= EPSILON || height <= EPSILON) return;

  const startPoint = pointAlongSegment(from, to, start);
  const endPoint = pointAlongSegment(from, to, end);
  const center = {
    x: (startPoint.x + endPoint.x) / 2,
    y: (startPoint.y + endPoint.y) / 2,
  };
  const rotationY = Math.atan2(to.y - from.y, to.x - from.x);
  const elevation = floor.level * FLOOR_LEVEL_HEIGHT_METERS;

  target.push({
    id: `${room.id}:wall:${segmentIndex}:${pieceIndex}`,
    roomId: room.id,
    floorId: floor.id,
    mesh: {
      kind: "box",
      size: [width, height, WALL_THICKNESS_METERS],
      position: toWorld(center, elevation + (bottom + top) / 2),
      rotation: [0, rotationY, 0],
    },
    userData: { domainId: room.id, domainType: "room" },
  });
}

function adaptRoomWalls(
  room: StructuralRoom,
  floor: StructuralFloor,
  walls: WallSegmentNode[],
  openings: OpeningNode[],
  warnings: string[],
): void {
  const candidates: CandidateOpening[] = [
    ...room.doors.map((door) => ({
      id: door.id,
      type: "door" as const,
      offset: door.wallOffset,
      deviceId: door.deviceId,
      isExterior: door.isExterior,
    })),
    ...room.windows.map((window) => ({
      id: window.id,
      type: "window" as const,
      offset: window.wallOffset,
      deviceId: window.deviceId,
      isExterior: false,
    })),
  ];

  for (let segmentIndex = 0; segmentIndex < room.polygon.length; segmentIndex += 1) {
    const [from, to] = wallSegmentEndpoints(room.polygon, segmentIndex);
    const segmentLength = Math.hypot(to.x - from.x, to.y - from.y);
    const onSegment = candidates
      .filter((opening) => opening.offset.wallSegmentIndex === segmentIndex)
      .sort((left, right) => left.offset.offsetMeters - right.offset.offsetMeters);

    let cursor = 0;
    let pieceIndex = 0;
    for (const opening of onSegment) {
      const rawStart = opening.offset.offsetMeters;
      const rawEnd = rawStart + opening.offset.widthMeters;
      if (
        !Number.isFinite(rawStart) ||
        !Number.isFinite(rawEnd) ||
        rawStart < 0 ||
        opening.offset.widthMeters <= 0 ||
        rawStart >= segmentLength
      ) {
        warnings.push(`Skipped invalid ${opening.type} ${opening.id} on room ${room.id}`);
        continue;
      }

      const start = Math.max(0, rawStart);
      const end = Math.min(segmentLength, rawEnd);
      if (rawEnd > segmentLength + EPSILON) {
        warnings.push(`Clamped ${opening.type} ${opening.id} to wall ${segmentIndex}`);
      }
      if (start < cursor - EPSILON) {
        warnings.push(`Skipped overlapping ${opening.type} ${opening.id} on room ${room.id}`);
        continue;
      }

      addWallPiece(
        walls,
        room,
        floor,
        segmentIndex,
        from,
        to,
        cursor,
        start,
        0,
        DEFAULT_ROOM_HEIGHT_METERS,
        pieceIndex++,
      );

      const bottom = opening.type === "door" ? 0 : WINDOW_BOTTOM_METERS;
      const height = opening.type === "door" ? DOOR_HEIGHT_METERS : WINDOW_HEIGHT_METERS;
      addWallPiece(walls, room, floor, segmentIndex, from, to, start, end, 0, bottom, pieceIndex++);
      addWallPiece(
        walls,
        room,
        floor,
        segmentIndex,
        from,
        to,
        start,
        end,
        bottom + height,
        DEFAULT_ROOM_HEIGHT_METERS,
        pieceIndex++,
      );

      const startPoint = pointAlongSegment(from, to, start);
      const endPoint = pointAlongSegment(from, to, end);
      const centerPoint = {
        x: (startPoint.x + endPoint.x) / 2,
        y: (startPoint.y + endPoint.y) / 2,
      };
      const elevation = floor.level * FLOOR_LEVEL_HEIGHT_METERS;
      openings.push({
        id: opening.id,
        type: opening.type,
        roomId: room.id,
        floorId: floor.id,
        deviceId: opening.deviceId,
        width: end - start,
        height,
        bottom,
        hinge: toWorld(startPoint, elevation + bottom),
        center: toWorld(centerPoint, elevation + bottom + height / 2),
        rotationY: Math.atan2(to.y - from.y, to.x - from.x),
        isExterior: opening.isExterior,
        userData: {
          domainId: opening.id,
          domainType: opening.type,
        },
      });
      cursor = end;
    }

    addWallPiece(
      walls,
      room,
      floor,
      segmentIndex,
      from,
      to,
      cursor,
      segmentLength,
      0,
      DEFAULT_ROOM_HEIGHT_METERS,
      pieceIndex,
    );
  }
}

/**
 * Pure structural-model to render-scene adapter. It is the only boundary at
 * which room polygons and wall offsets become 3D mesh descriptors.
 */
export function buildSceneGraph(model: StructuralModel): SceneGraph {
  const floors: FloorNode[] = [];
  const rooms: RoomNode[] = [];
  const walls: WallSegmentNode[] = [];
  const openings: OpeningNode[] = [];
  const deviceAnchors: DeviceAnchorNode[] = [];
  const warnings: string[] = [];

  for (const floor of [...model.floors].sort((left, right) => left.level - right.level)) {
    const elevation = floor.level * FLOOR_LEVEL_HEIGHT_METERS;
    floors.push({
      id: floor.id,
      name: floor.name,
      level: floor.level,
      elevation,
      userData: { domainId: floor.id, domainType: "floor" },
    });

    for (const room of floor.rooms) {
      if (room.polygon.length < 3 || !room.polygon.every(isFinitePoint)) {
        warnings.push(`Skipped invalid polygon for room ${room.id}`);
        continue;
      }

      rooms.push({
        id: room.id,
        floorId: floor.id,
        name: room.name,
        kind: room.kind,
        elevation,
        surface: {
          kind: "shape",
          points: room.polygon.map((point) => ({ ...point })),
          position: [0, elevation + FLOOR_THICKNESS_METERS / 2, 0],
          rotation: [-Math.PI / 2, 0, 0],
        },
        userData: { domainId: room.id, domainType: "room" },
      });

      adaptRoomWalls(room, floor, walls, openings, warnings);

      const sortedDevices = [...room.devices].sort((left, right) =>
        left.id.localeCompare(right.id),
      );
      sortedDevices.forEach((device, index) => {
        const point =
          device.positionX != null && device.positionY != null
            ? { x: device.positionX, y: device.positionY }
            : fallbackDevicePosition(room.polygon, index);
        deviceAnchors.push({
          id: device.id,
          label: device.label,
          category: device.category,
          roomId: room.id,
          floorId: floor.id,
          position: toWorld(point, elevation + 0.28),
          userData: { domainId: device.id, domainType: "device" },
        });
      });
    }
  }

  const validPolygons = model.floors.flatMap((floor) =>
    floor.rooms
      .filter((room) => room.polygon.length >= 3 && room.polygon.every(isFinitePoint))
      .map((room) => room.polygon),
  );
  const planBounds = boundsOfPolygons(validPolygons);
  const elevations = floors.map((floor) => floor.elevation);
  const minY = elevations.length > 0 ? Math.min(...elevations) : 0;
  const maxY = elevations.length > 0 ? Math.max(...elevations) + DEFAULT_ROOM_HEIGHT_METERS : 1;

  return {
    property: {
      id: model.propertyId,
      userData: { domainId: model.propertyId, domainType: "property" },
    },
    floors,
    rooms,
    walls,
    openings,
    deviceAnchors,
    bounds: {
      center: [
        (planBounds.minX + planBounds.maxX) / 2,
        (minY + maxY) / 2,
        -(planBounds.minY + planBounds.maxY) / 2,
      ],
      size: [
        Math.max(planBounds.maxX - planBounds.minX, 1),
        Math.max(maxY - minY, 1),
        Math.max(planBounds.maxY - planBounds.minY, 1),
      ],
      minY,
      maxY,
    },
    warnings,
  };
}
