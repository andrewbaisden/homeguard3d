import type { ScenarioDefinition } from "@homeguard/domain";

/**
 * Drives the real security state machine through the same ingestion
 * path a physical entry sensor would: arm → exit delay expiry →
 * door.opened (handler derives security.sensor_triggered) → entry
 * delay expiry → ALARM. Timer-expiry events are emitted on the
 * logical clock so the story stays deterministic at demo speeds.
 */
export const intrusionScenario: ScenarioDefinition = {
  key: "intrusion",
  name: "Intrusion",
  seed: 911,
  script: {
    description:
      "Arms Away, breaches a seeded entrance contact sensor, and escalates through entry delay to alarm.",
    steps: [
      {
        atSimTimeMs: 0,
        eventTemplate: {
          type: "security.arm_requested",
          metadata: { mode: "AWAY", override: true },
        },
      },
      {
        atSimTimeMs: 500,
        eventTemplate: { type: "security.exit_delay_expired", metadata: {} },
      },
      {
        atSimTimeMs: 1_000,
        target: { categories: ["CONTACT_SENSOR"], pick: "SEEDED" },
        eventTemplate: { type: "door.opened", metadata: {} },
      },
      {
        atSimTimeMs: 2_500,
        target: { categories: ["MOTION_SENSOR"], pick: "SEEDED" },
        eventTemplate: { type: "motion.started", metadata: {} },
      },
      {
        atSimTimeMs: 4_000,
        eventTemplate: { type: "security.entry_delay_expired", metadata: {} },
      },
    ],
  },
};
