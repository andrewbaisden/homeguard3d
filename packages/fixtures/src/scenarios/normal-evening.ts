import type { ScenarioDefinition } from "@homeguard/domain";

const contact = { categories: ["CONTACT_SENSOR" as const], pick: "FIRST" as const };
const motion = { categories: ["MOTION_SENSOR" as const], pick: "SEEDED" as const };

export const normalEveningScenario: ScenarioDefinition = {
  key: "normal-evening",
  name: "Normal Evening",
  seed: 2_026,
  script: {
    description: "Someone arrives home, closes the entrance, and moves through the house.",
    steps: [
      {
        atSimTimeMs: 0,
        target: contact,
        eventTemplate: { type: "device.online", metadata: {} },
      },
      {
        atSimTimeMs: 1_000,
        target: contact,
        eventTemplate: { type: "door.opened", metadata: {} },
      },
      {
        atSimTimeMs: 2_500,
        target: motion,
        eventTemplate: { type: "motion.started", metadata: {} },
      },
      {
        atSimTimeMs: 4_000,
        target: contact,
        eventTemplate: { type: "door.closed", metadata: {} },
      },
      {
        atSimTimeMs: 7_000,
        target: motion,
        eventTemplate: { type: "motion.cleared", metadata: {} },
      },
    ],
  },
};
