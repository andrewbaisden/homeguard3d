import type { ScenarioDefinition } from "@homeguard/domain";

const infrastructure = {
  categories: ["HUB" as const, "CAMERA" as const],
  pick: "SEEDED" as const,
};

export const deviceFailureScenario: ScenarioDefinition = {
  key: "device-failure",
  name: "Device Failure",
  seed: 503,
  script: {
    description: "A seeded hub or camera reports online, then abruptly drops offline.",
    steps: [
      {
        atSimTimeMs: 0,
        target: infrastructure,
        eventTemplate: { type: "device.online", metadata: {} },
      },
      {
        atSimTimeMs: 2_000,
        target: infrastructure,
        eventTemplate: { type: "device.offline", metadata: {} },
      },
    ],
  },
};
