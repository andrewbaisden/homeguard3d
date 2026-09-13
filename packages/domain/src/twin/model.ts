import type { Point, WallOffset } from "../geometry/plan";

export interface StructuralDevice {
  id: string;
  label: string;
  category: string;
  roomId: string | null;
  positionX: number | null;
  positionY: number | null;
  capabilities: string[];
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

/** The one structural model consumed by both the 2D and 3D renderers. */
export interface StructuralModel {
  propertyId: string;
  propertyName: string;
  floors: StructuralFloor[];
}
