import { describe, expect, it } from "vitest";
import { advanceSimulationClock, dueStepIndexes } from "../clock";
import { createSeededRandom, resolveScenarioDevice } from "../scenario";

describe("simulation primitives", () => {
  it("advances logical time by speed and stops at the scenario end", () => {
    expect(
      advanceSimulationClock({ simClockMs: 100, speedFactor: 4, status: "RUNNING" }, 50, 250),
    ).toEqual({ simClockMs: 250, speedFactor: 4, status: "COMPLETED" });
    expect(dueStepIndexes([0, 100, 250, 300], 99, 250)).toEqual([1, 2]);
  });

  it("is deterministic for a seed and stable device ordering", () => {
    expect(createSeededRandom(42)()).toBe(createSeededRandom(42)());
    const target = { categories: ["MOTION_SENSOR" as const], pick: "SEEDED" as const };
    const devices = [
      { id: "b", category: "MOTION_SENSOR" as const },
      { id: "a", category: "MOTION_SENSOR" as const },
    ];
    expect(resolveScenarioDevice(target, devices, 42, 1)).toEqual(
      resolveScenarioDevice(target, [...devices].reverse(), 42, 1),
    );
  });
});
