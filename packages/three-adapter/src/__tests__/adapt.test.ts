import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROOM_HEIGHT_METERS,
  FLOOR_LEVEL_HEIGHT_METERS,
  type StructuralModel,
  buildSceneGraph,
} from "../adapt";

function fixture(): StructuralModel {
  return {
    propertyId: "property-1",
    propertyName: "Test home",
    floors: [
      {
        id: "floor-1",
        name: "Ground floor",
        level: 0,
        rooms: [
          {
            id: "room-1",
            name: "Hall",
            kind: "HALLWAY",
            polygon: [
              { x: 0, y: 0 },
              { x: 6, y: 0 },
              { x: 6, y: 4 },
              { x: 0, y: 4 },
            ],
            doors: [
              {
                id: "door-1",
                wallOffset: { wallSegmentIndex: 0, offsetMeters: 1, widthMeters: 1 },
                deviceId: "device-door",
                isExterior: true,
              },
            ],
            windows: [
              {
                id: "window-1",
                wallOffset: { wallSegmentIndex: 2, offsetMeters: 2, widthMeters: 1.5 },
                deviceId: null,
              },
            ],
            devices: [
              {
                id: "device-motion",
                label: "Motion",
                category: "MOTION_SENSOR",
                roomId: "room-1",
                positionX: null,
                positionY: null,
                capabilities: ["MOTION"],
              },
              {
                id: "device-door",
                label: "Front door",
                category: "CONTACT_SENSOR",
                roomId: "room-1",
                positionX: 1.5,
                positionY: 0.3,
                capabilities: ["CONTACT"],
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("buildSceneGraph", () => {
  it("maps every structural node to stable domain userData", () => {
    const graph = buildSceneGraph(fixture());

    expect(graph.property.userData).toEqual({ domainId: "property-1", domainType: "property" });
    expect(graph.floors[0]?.userData).toEqual({ domainId: "floor-1", domainType: "floor" });
    expect(graph.rooms[0]?.userData).toEqual({ domainId: "room-1", domainType: "room" });
    expect(graph.openings.map((opening) => opening.userData)).toEqual([
      { domainId: "door-1", domainType: "door" },
      { domainId: "window-1", domainType: "window" },
    ]);
    expect(graph.deviceAnchors.map((anchor) => anchor.userData.domainId).sort()).toEqual([
      "device-door",
      "device-motion",
    ]);
    expect(graph.walls.every((wall) => wall.userData.domainId === "room-1")).toBe(true);
  });

  it("turns openings into wall gaps plus door/window descriptors", () => {
    const graph = buildSceneGraph(fixture());
    const door = graph.openings.find((opening) => opening.id === "door-1");
    const window = graph.openings.find((opening) => opening.id === "window-1");

    expect(door).toMatchObject({
      type: "door",
      width: 1,
      height: 2.1,
      bottom: 0,
      deviceId: "device-door",
    });
    expect(window).toMatchObject({
      type: "window",
      width: 1.5,
      height: 1.2,
      bottom: 0.9,
    });
    expect(graph.walls.length).toBe(9);
  });

  it("uses saved device positions and stable fallback positions", () => {
    const graph = buildSceneGraph(fixture());
    expect(graph.deviceAnchors.find((anchor) => anchor.id === "device-door")?.position).toEqual([
      1.5, 0.28, -0.3,
    ]);

    const repeated = buildSceneGraph(fixture());
    expect(repeated.deviceAnchors).toEqual(graph.deviceAnchors);
  });

  it("derives floor elevation from level without adding schema fields", () => {
    const model = fixture();
    model.floors.push({ id: "floor-2", name: "Upstairs", level: 1, rooms: [] });
    const graph = buildSceneGraph(model);

    expect(graph.floors.find((floor) => floor.id === "floor-2")?.elevation).toBe(
      FLOOR_LEVEL_HEIGHT_METERS,
    );
    expect(graph.bounds.maxY).toBe(FLOOR_LEVEL_HEIGHT_METERS + DEFAULT_ROOM_HEIGHT_METERS);
  });

  it("warns and skips malformed rooms and overlapping openings", () => {
    const model = fixture();
    const floor = model.floors[0];
    const room = floor?.rooms[0];
    if (!floor || !room) throw new Error("Fixture is incomplete");
    floor.rooms.push({
      id: "bad-room",
      name: "Bad",
      kind: "OTHER",
      polygon: [{ x: 0, y: 0 }],
      doors: [],
      windows: [],
      devices: [],
    });
    room.doors.push({
      id: "overlap",
      wallOffset: { wallSegmentIndex: 0, offsetMeters: 1.5, widthMeters: 1 },
      deviceId: null,
      isExterior: false,
    });

    const graph = buildSceneGraph(model);
    expect(graph.rooms.some((room) => room.id === "bad-room")).toBe(false);
    expect(graph.openings.some((opening) => opening.id === "overlap")).toBe(false);
    expect(graph.warnings).toEqual([
      "Skipped overlapping door overlap on room room-1",
      "Skipped invalid polygon for room bad-room",
    ]);
  });

  it("clamps an opening that extends beyond its wall", () => {
    const model = fixture();
    const door = model.floors[0]?.rooms[0]?.doors[0];
    if (!door) throw new Error("Fixture is incomplete");
    door.wallOffset = {
      wallSegmentIndex: 0,
      offsetMeters: 5.5,
      widthMeters: 2,
    };
    const graph = buildSceneGraph(model);

    expect(graph.openings[0]?.width).toBe(0.5);
    expect(graph.warnings).toEqual(["Clamped door door-1 to wall 0"]);
  });
});
