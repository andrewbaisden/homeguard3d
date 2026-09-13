/**
 * Pure 2D geometry helpers for the floor plan canvas — property-local
 * coordinates in meters, the same space Room.polygon and Door/Window
 * wallOffset already use. No React, no DOM — safe to reuse from the
 * Phase 7 3D geometry adapter later if the shapes turn out to overlap,
 * but not shared speculatively before that need is real.
 */

export interface Point {
  x: number;
  y: number;
}

export interface WallOffset {
  wallSegmentIndex: number;
  offsetMeters: number;
  widthMeters: number;
}

export function wallSegmentEndpoints(polygon: Point[], segmentIndex: number): [Point, Point] {
  const from = polygon[segmentIndex % polygon.length];
  const to = polygon[(segmentIndex + 1) % polygon.length];
  if (!from || !to) {
    throw new Error(
      `Invalid wall segment index ${segmentIndex} for a ${polygon.length}-point polygon`,
    );
  }
  return [from, to];
}

function pointAlongSegment(from: Point, to: Point, distanceMeters: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const t = length === 0 ? 0 : distanceMeters / length;
  return { x: from.x + dx * t, y: from.y + dy * t };
}

/** The two endpoints of a door/window's span along its wall. */
export function wallOffsetSpan(polygon: Point[], offset: WallOffset): [Point, Point] {
  const [from, to] = wallSegmentEndpoints(polygon, offset.wallSegmentIndex);
  return [
    pointAlongSegment(from, to, offset.offsetMeters),
    pointAlongSegment(from, to, offset.offsetMeters + offset.widthMeters),
  ];
}

export function polygonCentroid(polygon: Point[]): Point {
  const sum = polygon.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), {
    x: 0,
    y: 0,
  });
  return { x: sum.x / polygon.length, y: sum.y / polygon.length };
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boundsOfPolygons(polygons: Point[][]): Bounds {
  const points = polygons.flat();
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  }
  return {
    minX: Math.min(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxX: Math.max(...points.map((p) => p.x)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}

/**
 * A default position for a device with no stored positionX/positionY —
 * spread unpositioned devices around their room's centroid so they
 * don't render on top of one another.
 */
export function fallbackDevicePosition(roomPolygon: Point[], indexInRoom: number): Point {
  const centroid = polygonCentroid(roomPolygon);
  const angle = (indexInRoom * 137.5 * Math.PI) / 180; // golden-angle spiral
  const radius = 0.35 + indexInRoom * 0.25;
  return { x: centroid.x + Math.cos(angle) * radius, y: centroid.y + Math.sin(angle) * radius };
}
