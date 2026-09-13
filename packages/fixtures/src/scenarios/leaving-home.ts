import type { ScenarioDefinition } from "@homeguard/domain";

export const leavingHomeScenario: ScenarioDefinition = {
  key: "leaving-home",
  name: "Leaving Home",
  seed: 110,
  script: {
    description: "Interior motion clears, the entrance closes, and the door locks behind you.",
    steps: [
      {
        atSimTimeMs: 0,
        target: { categories: ["MOTION_SENSOR"], pick: "SEEDED" },
        eventTemplate: { type: "motion.cleared", metadata: {} },
      },
      {
        atSimTimeMs: 1_000,
        target: { categories: ["CONTACT_SENSOR"], pick: "FIRST" },
        eventTemplate: { type: "door.opened", metadata: {} },
      },
      {
        atSimTimeMs: 3_000,
        target: { categories: ["CONTACT_SENSOR"], pick: "FIRST" },
        eventTemplate: { type: "door.closed", metadata: {} },
      },
      {
        atSimTimeMs: 4_000,
        target: { categories: ["LOCK"], pick: "FIRST" },
        eventTemplate: { type: "lock.locked", metadata: {} },
      },
    ],
  },
};
