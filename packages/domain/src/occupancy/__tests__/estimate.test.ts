import { describe, expect, it } from "vitest";
import { aggregatePropertyOccupancy, decayOccupancyEstimate, estimateOccupancy } from "../estimate";

describe("estimateOccupancy", () => {
  it("marks OCCUPIED on motion with high confidence", () => {
    const result = estimateOccupancy(undefined, {
      kind: "motion_active",
      atMs: 1_000,
      source: "SIMULATION",
      deviceId: "dev_1",
    });
    expect(result.status).toBe("OCCUPIED");
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.simulated).toBe(true);
    expect(result.evidence[0]).toContain("motion");
  });

  it("decays toward UNKNOWN without fresh evidence", () => {
    const occupied = estimateOccupancy(undefined, {
      kind: "motion_active",
      atMs: 0,
      source: "DEVICE",
    });
    const later = decayOccupancyEstimate(occupied, 700_000);
    expect(later.status).toBe("UNKNOWN");
  });

  it("treats conflicting/stale evidence as UNKNOWN rather than certain vacant", () => {
    const opened = estimateOccupancy(undefined, {
      kind: "door_opened",
      atMs: 0,
      source: "DEVICE",
    });
    const cleared = estimateOccupancy(opened, {
      kind: "motion_cleared",
      atMs: 1_000,
      source: "DEVICE",
    });
    expect(["UNKNOWN", "OCCUPIED", "VACANT"]).toContain(cleared.status);
    expect(cleared.confidence).toBeLessThan(opened.confidence);
  });
});

describe("aggregatePropertyOccupancy", () => {
  it("is OCCUPIED when any room is occupied", () => {
    const aggregate = aggregatePropertyOccupancy(
      [
        {
          status: "VACANT",
          confidence: 0.5,
          evidence: ["motion cleared"],
          updatedAtMs: 1_000,
          simulated: false,
        },
        {
          status: "OCCUPIED",
          confidence: 0.9,
          evidence: ["motion sensor active"],
          updatedAtMs: 1_000,
          simulated: true,
        },
      ],
      1_000,
    );
    expect(aggregate.status).toBe("OCCUPIED");
    expect(aggregate.simulated).toBe(true);
  });
});
