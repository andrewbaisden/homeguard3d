import { simulationScriptSchema } from "@homeguard/domain";
import { describe, expect, it } from "vitest";
import { simulationScenarios } from "../index";

describe("simulation scenario fixtures", () => {
  it("ships the Phase 9/10 story set", () => {
    expect(simulationScenarios.map((scenario) => scenario.key)).toEqual([
      "normal-evening",
      "leaving-home",
      "night-mode",
      "intrusion",
      "device-failure",
    ]);
  });

  it("contains sorted, schema-valid deterministic steps", () => {
    for (const scenario of simulationScenarios) {
      expect(simulationScriptSchema.safeParse(scenario.script).success).toBe(true);
      expect(scenario.script.steps.map((step) => step.atSimTimeMs)).toEqual(
        [...scenario.script.steps].map((step) => step.atSimTimeMs).sort((a, b) => a - b),
      );
    }
  });

  it("keeps simulated events explicit at the provider boundary", () => {
    for (const scenario of simulationScenarios) {
      for (const step of scenario.script.steps) {
        expect(step.eventTemplate).not.toHaveProperty("source");
      }
    }
  });

  it("drives intrusion through the normalized security pipeline", () => {
    const intrusion = simulationScenarios.find((scenario) => scenario.key === "intrusion");
    expect(intrusion).toBeDefined();
    const types = intrusion?.script.steps.map((step) => step.eventTemplate.type) ?? [];
    expect(types).toEqual([
      "security.arm_requested",
      "security.exit_delay_expired",
      "door.opened",
      "motion.started",
      "security.entry_delay_expired",
    ]);
    expect(types).not.toContain("security.sensor_triggered");
  });
});
