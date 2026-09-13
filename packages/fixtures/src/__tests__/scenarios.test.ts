import { simulationScriptSchema } from "@homeguard/domain";
import { describe, expect, it } from "vitest";
import { simulationScenarios } from "../index";

describe("simulation scenario fixtures", () => {
  it("contains sorted, schema-valid deterministic steps", () => {
    for (const scenario of simulationScenarios) {
      expect(simulationScriptSchema.safeParse(scenario.script).success).toBe(true);
      expect(scenario.script.steps.map((step) => step.atSimTimeMs)).toEqual(
        [...scenario.script.steps].map((step) => step.atSimTimeMs).sort((a, b) => a - b),
      );
    }
  });
});
