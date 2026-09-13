import { describe, expect, it } from "vitest";
import {
  boundsOfPolygons,
  fallbackDevicePosition,
  pointAlongSegment,
  polygonCentroid,
  wallOffsetSpan,
  wallSegmentEndpoints,
  wallSegmentLength,
} from "../plan";

const rectangle = [
  { x: 0, y: 0 },
  { x: 6, y: 0 },
  { x: 6, y: 4 },
  { x: 0, y: 4 },
];

describe("plan geometry", () => {
  it("resolves wrapping wall endpoints and segment length", () => {
    expect(wallSegmentEndpoints(rectangle, 3)).toEqual([
      { x: 0, y: 4 },
      { x: 0, y: 0 },
    ]);
    expect(wallSegmentLength(rectangle, 3)).toBe(4);
  });

  it("rejects invalid wall indices", () => {
    expect(() => wallSegmentEndpoints(rectangle, -1)).toThrow("Invalid wall segment index");
    expect(() => wallSegmentEndpoints(rectangle, 4)).toThrow("Invalid wall segment index");
  });

  it("finds points and opening spans along a wall", () => {
    const from = rectangle[0];
    const to = rectangle[1];
    if (!from || !to) throw new Error("Rectangle fixture is incomplete");
    expect(pointAlongSegment(from, to, 2)).toEqual({ x: 2, y: 0 });
    expect(
      wallOffsetSpan(rectangle, { wallSegmentIndex: 0, offsetMeters: 1, widthMeters: 2 }),
    ).toEqual([
      { x: 1, y: 0 },
      { x: 3, y: 0 },
    ]);
  });

  it("computes an area-weighted centroid", () => {
    expect(polygonCentroid(rectangle)).toEqual({ x: 3, y: 2 });
    expect(
      polygonCentroid([
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 1 },
        { x: 1, y: 1 },
        { x: 1, y: 4 },
        { x: 0, y: 4 },
      ]),
    ).toEqual({ x: 1.3571428571428572, y: 1.3571428571428572 });
  });

  it("handles empty and degenerate polygon centroids", () => {
    expect(polygonCentroid([])).toEqual({ x: 0, y: 0 });
    expect(
      polygonCentroid([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ]),
    ).toEqual({ x: 1, y: 0 });
  });

  it("computes combined bounds with a safe empty fallback", () => {
    expect(boundsOfPolygons([rectangle, [{ x: -2, y: 7 }]])).toEqual({
      minX: -2,
      minY: 0,
      maxX: 6,
      maxY: 7,
    });
    expect(boundsOfPolygons([])).toEqual({ minX: 0, minY: 0, maxX: 1, maxY: 1 });
  });

  it("places unpositioned devices deterministically around the centroid", () => {
    expect(fallbackDevicePosition(rectangle, 0)).toEqual({ x: 3.35, y: 2 });
    expect(fallbackDevicePosition(rectangle, 1)).toEqual(fallbackDevicePosition(rectangle, 1));
    expect(fallbackDevicePosition(rectangle, 1)).not.toEqual(fallbackDevicePosition(rectangle, 0));
  });
});
