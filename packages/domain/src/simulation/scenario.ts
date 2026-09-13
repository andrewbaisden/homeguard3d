import { z } from "zod";

export const simulationDeviceCategorySchema = z.enum([
  "CAMERA",
  "LOCK",
  "CONTACT_SENSOR",
  "MOTION_SENSOR",
  "ENV_SENSOR",
  "SIREN",
  "HUB",
]);

export const simulationTargetSchema = z.object({
  categories: z.array(simulationDeviceCategorySchema).min(1),
  pick: z.enum(["FIRST", "SEEDED"]).default("FIRST"),
});

export const simulationStepSchema = z.object({
  atSimTimeMs: z.number().int().nonnegative(),
  target: simulationTargetSchema.optional(),
  eventTemplate: z.object({
    type: z.string().min(1),
    metadata: z.record(z.unknown()),
  }),
});

export const simulationScriptSchema = z.object({
  description: z.string().min(1),
  steps: z.array(simulationStepSchema).min(1),
});

export type SimulationTarget = z.infer<typeof simulationTargetSchema>;
export type SimulationStep = z.infer<typeof simulationStepSchema>;
export type SimulationScript = z.infer<typeof simulationScriptSchema>;

export interface ScenarioDefinition {
  key: string;
  name: string;
  seed: number;
  script: SimulationScript;
}

export interface ScenarioDevice {
  id: string;
  category: z.infer<typeof simulationDeviceCategorySchema>;
}

/** Mulberry32: small, deterministic and suitable for repeatable demo branching. */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function resolveScenarioDevice(
  target: SimulationTarget,
  devices: ScenarioDevice[],
  seed: number,
  stepIndex: number,
): ScenarioDevice | undefined {
  const matches = devices
    .filter((device) => target.categories.includes(device.category))
    .sort((left, right) => left.id.localeCompare(right.id));
  if (matches.length === 0) return undefined;
  if (target.pick === "FIRST") return matches[0];
  const random = createSeededRandom(seed + stepIndex * 1_009);
  return matches[Math.floor(random() * matches.length)];
}

export function missingScenarioCategories(
  script: SimulationScript,
  devices: ScenarioDevice[],
): string[] {
  const missing = script.steps.flatMap((step) => {
    if (!step.target) return [];
    return step.target.categories.some((category) =>
      devices.some((device) => device.category === category),
    )
      ? []
      : [step.target.categories.join(" or ")];
  });
  return [...new Set(missing)];
}
