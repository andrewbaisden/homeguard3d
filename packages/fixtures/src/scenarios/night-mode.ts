import type { ScenarioDefinition } from "@homeguard/domain";

export const nightModeScenario: ScenarioDefinition = {
  key: "night-mode",
  name: "Night Mode",
  seed: 220,
  script: {
    description: "The entrance locks and perimeter security arms for the night.",
    steps: [
      {
        atSimTimeMs: 0,
        target: { categories: ["LOCK"], pick: "FIRST" },
        eventTemplate: { type: "lock.locked", metadata: {} },
      },
      {
        atSimTimeMs: 1_000,
        eventTemplate: {
          type: "security.arm_requested",
          metadata: { mode: "NIGHT", override: true },
        },
      },
      {
        atSimTimeMs: 2_000,
        eventTemplate: { type: "security.exit_delay_expired", metadata: {} },
      },
    ],
  },
};
