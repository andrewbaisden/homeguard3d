/** Property-local 2D coordinates in meters. */
export interface Point {
  x: number;
  y: number;
}

/** A span along one edge of a room polygon. */
export interface WallOffset {
  wallSegmentIndex: number;
  offsetMeters: number;
  widthMeters: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function wallSegmentEndpoints(polygon: Point[], segmentIndex: number): [Point, Point] {
  if (!Number.isInteger(segmentIndex) || segmentIndex < 0 || segmentIndex >= polygon.length) {
    throw new Error(
      `Invalid wall segment index ${segmentIndex} for a ${polygon.length}-point polygon`,
    );
  }

  const from = polygon[segmentIndex];
  const to = polygon[(segmentIndex + 1) % polygon.length];
  if (!from || !to) {
    throw new Error(
      `Invalid wall segment index ${segmentIndex} for a ${polygon.length}-point polygon`,
    );
  }
  return [from, to];
}

export function wallSegmentLength(polygon: Point[], segmentIndex: number): number {
  const [from, to] = wallSegmentEndpoints(polygon, segmentIndex);
  return Math.hypot(to.x - from.x, to.y - from.y);
}

export function pointAlongSegment(from: Point, to: Point, distanceMeters: number): Point {
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

/**
 * Area-weighted polygon centroid. Degenerate polygons fall back to the
 * arithmetic mean so rendering code always receives a finite point.
 */
export function polygonCentroid(polygon: Point[]): Point {
  if (polygon.length === 0) return { x: 0, y: 0 };

  let twiceArea = 0;
  let xNumerator = 0;
  let yNumerator = 0;

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    if (!current || !next) continue;
    const cross = current.x * next.y - next.x * current.y;
    twiceArea += cross;
    xNumerator += (current.x + next.x) * cross;
    yNumerator += (current.y + next.y) * cross;
  }

  if (Math.abs(twiceArea) > Number.EPSILON) {
    return {
      x: xNumerator / (3 * twiceArea),
      y: yNumerator / (3 * twiceArea),
    };
  }

  const sum = polygon.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), {
    x: 0,
    y: 0,
  });
  return { x: sum.x / polygon.length, y: sum.y / polygon.length };
}

export function boundsOfPolygons(polygons: Point[][]): Bounds {
  const points = polygons.flat();
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  }
  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

/**
 * Stable fallback for a device with no saved placement. Callers sort room
 * devices by domain ID before supplying indexInRoom so every renderer uses
 * the same golden-angle position.
 */
export function fallbackDevicePosition(roomPolygon: Point[], indexInRoom: number): Point {
  const centroid = polygonCentroid(roomPolygon);
  const angle = (indexInRoom * 137.5 * Math.PI) / 180;
  const radius = 0.35 + indexInRoom * 0.25;
  return { x: centroid.x + Math.cos(angle) * radius, y: centroid.y + Math.sin(angle) * radius };
}
