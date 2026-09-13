import { type Prisma, type SimulationRun, prisma } from "@homeguard/database";
import {
  type DomainEventInput,
  type ScenarioDefinition,
  type ScenarioDevice,
  type SimulationClockState,
  SimulationProvider,
  type SimulationStatus,
  advanceSimulationClock,
  dueStepIndexes,
  missingScenarioCategories,
  resolveScenarioDevice,
  simulationScriptSchema,
} from "@homeguard/domain";
import { simulationScenarios } from "@homeguard/fixtures";
import { Redis } from "ioredis";
import { ingestEvent } from "../ingestion/handler";
import type { RealtimeBus } from "../realtime/pubsub";

const TICK_MS = 100;
const POSTGRES_CHECKPOINT_MS = 1_000;

export class SimulationControlError extends Error {}

interface Runtime {
  runId: string;
  propertyId: string;
  definition: ScenarioDefinition;
  devices: ScenarioDevice[];
  startedAt: Date;
  clock: SimulationClockState;
  lastWallMs: number;
  lastCheckpointWallMs: number;
  timer: NodeJS.Timeout | undefined;
  busy: boolean;
}

function endTime(definition: ScenarioDefinition): number {
  return Math.max(...definition.script.steps.map((step) => step.atSimTimeMs));
}

function definitionFor(key: string): ScenarioDefinition {
  const definition = simulationScenarios.find((item) => item.key === key);
  if (!definition) throw new SimulationControlError(`Unknown scenario ${key}`);
  return definition;
}

export class SimulationManager {
  readonly #provider = new SimulationProvider();
  readonly #redis: Redis;
  readonly #runtimes = new Map<string, Runtime>();

  constructor(redisUrl: string, bus: RealtimeBus) {
    this.#redis = new Redis(redisUrl);
    this.#provider.onEvent(async (event) => {
      await ingestEvent(event, bus);
    });
  }

  async initialize(): Promise<void> {
    await this.#ensureScenarios();
    const running = await prisma.simulationRun.findMany({
      where: { status: "RUNNING" },
      include: { scenario: true },
    });
    for (const run of running) {
      const definition = definitionFor(run.scenario.key);
      const runtime = await this.#makeRuntime(run, definition);
      const cached = await this.#redis.get(this.#redisKey(run.id));
      if (cached) {
        const parsed = JSON.parse(cached) as { simClockMs?: unknown };
        if (typeof parsed.simClockMs === "number" && Number.isFinite(parsed.simClockMs)) {
          runtime.clock.simClockMs = Math.max(runtime.clock.simClockMs, parsed.simClockMs);
        }
      }
      this.#startTimer(runtime);
    }
  }

  async status(propertyId: string): Promise<SimulationStatus> {
    await this.#ensureScenarios();
    const devices = await this.#devices(propertyId);
    const run = await prisma.simulationRun.findFirst({
      where: { propertyId },
      orderBy: { startedAt: "desc" },
      include: { scenario: true },
    });
    const runtime = run ? this.#runtimes.get(run.id) : undefined;

    return {
      scenarios: simulationScenarios.map((definition) => {
        const missingCategories = missingScenarioCategories(definition.script, devices);
        return {
          key: definition.key,
          name: definition.name,
          description: definition.script.description,
          durationMs: endTime(definition),
          available: missingCategories.length === 0,
          missingCategories,
        };
      }),
      run: run
        ? {
            id: run.id,
            scenarioKey: run.scenario.key,
            scenarioName: run.scenario.name,
            status: runtime?.clock.status ?? run.status,
            speedFactor: runtime?.clock.speedFactor ?? run.speedFactor,
            simClockMs: Math.round(runtime?.clock.simClockMs ?? run.simClockMs),
            durationMs: endTime(definitionFor(run.scenario.key)),
          }
        : null,
    };
  }

  async start(propertyId: string, scenarioKey: string, speedFactor: number): Promise<void> {
    const definition = definitionFor(scenarioKey);
    const devices = await this.#devices(propertyId);
    const missing = missingScenarioCategories(definition.script, devices);
    if (missing.length > 0) {
      throw new SimulationControlError(`Scenario needs ${missing.join(", ")}`);
    }
    await this.#stopPropertyRuntime(propertyId, "COMPLETED");
    const scenario = await this.#upsertScenario(definition);
    const startedAt = new Date();
    const run = await prisma.simulationRun.create({
      data: {
        propertyId,
        scenarioId: scenario.id,
        status: "RUNNING",
        speedFactor,
        simClockMs: 0,
        startedAt,
      },
    });
    const runtime = await this.#makeRuntime(run, definition, devices);
    await this.#emitDue(runtime, -1, 0);
    this.#startTimer(runtime);
  }

  async pause(propertyId: string): Promise<void> {
    const runtime = this.#runtimeForProperty(propertyId);
    if (!runtime) throw new SimulationControlError("No running simulation");
    runtime.clock = { ...runtime.clock, status: "PAUSED" };
    if (runtime.timer) clearInterval(runtime.timer);
    runtime.timer = undefined;
    await this.#checkpoint(runtime);
  }

  async resume(propertyId: string): Promise<void> {
    let runtime = this.#runtimeForProperty(propertyId);
    if (!runtime) {
      const run = await prisma.simulationRun.findFirst({
        where: { propertyId, status: "PAUSED" },
        orderBy: { startedAt: "desc" },
        include: { scenario: true },
      });
      if (!run) throw new SimulationControlError("No paused simulation");
      runtime = await this.#makeRuntime(run, definitionFor(run.scenario.key));
    }
    runtime.clock = { ...runtime.clock, status: "RUNNING" };
    runtime.lastWallMs = performance.now();
    this.#startTimer(runtime);
    await this.#checkpoint(runtime);
  }

  async reset(propertyId: string): Promise<void> {
    const runtime = this.#runtimeForProperty(propertyId);
    if (runtime?.timer) clearInterval(runtime.timer);
    if (runtime) {
      this.#runtimes.delete(runtime.runId);
      await this.#provider.disconnect(propertyId);
      await this.#redis.del(this.#redisKey(runtime.runId));
    }
    await prisma.simulationRun.updateMany({
      where: { propertyId, status: { in: ["RUNNING", "PAUSED"] } },
      data: { status: "IDLE", simClockMs: 0 },
    });
  }

  async setSpeed(propertyId: string, speedFactor: number): Promise<void> {
    const runtime = this.#runtimeForProperty(propertyId);
    if (!runtime) throw new SimulationControlError("No active simulation");
    runtime.clock = { ...runtime.clock, speedFactor };
    await this.#checkpoint(runtime);
  }

  async close(): Promise<void> {
    for (const runtime of this.#runtimes.values()) {
      if (runtime.timer) clearInterval(runtime.timer);
    }
    await this.#redis.quit();
  }

  async #ensureScenarios(): Promise<void> {
    await Promise.all(simulationScenarios.map((definition) => this.#upsertScenario(definition)));
  }

  async #upsertScenario(definition: ScenarioDefinition) {
    return prisma.simulationScenario.upsert({
      where: { key: definition.key },
      create: {
        key: definition.key,
        name: definition.name,
        seed: definition.seed,
        script: definition.script as Prisma.InputJsonValue,
      },
      update: {
        name: definition.name,
        seed: definition.seed,
        script: definition.script as Prisma.InputJsonValue,
      },
    });
  }

  async #devices(propertyId: string): Promise<ScenarioDevice[]> {
    return prisma.device.findMany({
      where: { propertyId },
      orderBy: { id: "asc" },
      select: { id: true, category: true },
    });
  }

  async #makeRuntime(
    run: SimulationRun,
    definition: ScenarioDefinition,
    knownDevices?: ScenarioDevice[],
  ): Promise<Runtime> {
    const runtime: Runtime = {
      runId: run.id,
      propertyId: run.propertyId,
      definition,
      devices: knownDevices ?? (await this.#devices(run.propertyId)),
      startedAt: run.startedAt ?? new Date(),
      clock: {
        simClockMs: run.simClockMs,
        speedFactor: run.speedFactor,
        status: run.status === "PAUSED" ? "PAUSED" : "RUNNING",
      },
      lastWallMs: performance.now(),
      lastCheckpointWallMs: performance.now(),
      timer: undefined,
      busy: false,
    };
    await this.#provider.connect(run.propertyId);
    this.#runtimes.set(run.id, runtime);
    return runtime;
  }

  #startTimer(runtime: Runtime): void {
    if (runtime.timer) clearInterval(runtime.timer);
    runtime.lastWallMs = performance.now();
    runtime.timer = setInterval(() => {
      void this.#tick(runtime).catch((error) => {
        console.error(`[simulation] run ${runtime.runId} tick failed`, error);
      });
    }, TICK_MS);
  }

  async #tick(runtime: Runtime): Promise<void> {
    if (runtime.busy || runtime.clock.status !== "RUNNING") return;
    runtime.busy = true;
    try {
      const wallNow = performance.now();
      const previous = runtime.clock.simClockMs;
      runtime.clock = advanceSimulationClock(
        runtime.clock,
        wallNow - runtime.lastWallMs,
        endTime(runtime.definition),
      );
      runtime.lastWallMs = wallNow;
      await this.#emitDue(runtime, previous, runtime.clock.simClockMs);
      await this.#redis.set(
        this.#redisKey(runtime.runId),
        JSON.stringify(runtime.clock),
        "EX",
        86_400,
      );
      if (
        wallNow - runtime.lastCheckpointWallMs >= POSTGRES_CHECKPOINT_MS ||
        runtime.clock.status === "COMPLETED"
      ) {
        await this.#checkpoint(runtime);
        runtime.lastCheckpointWallMs = wallNow;
      }
      if (runtime.clock.status === "COMPLETED") {
        if (runtime.timer) clearInterval(runtime.timer);
        runtime.timer = undefined;
        await this.#provider.disconnect(runtime.propertyId);
        this.#runtimes.delete(runtime.runId);
      }
    } finally {
      runtime.busy = false;
    }
  }

  async #emitDue(runtime: Runtime, previous: number, current: number): Promise<void> {
    const steps = runtime.definition.script.steps;
    const due = dueStepIndexes(
      steps.map((step) => step.atSimTimeMs),
      previous,
      current,
    );
    for (const stepIndex of due) {
      const step = steps[stepIndex];
      if (!step) continue;
      const device = step.target
        ? resolveScenarioDevice(step.target, runtime.devices, runtime.definition.seed, stepIndex)
        : undefined;
      const command = {
        eventId: `simulation:${runtime.runId}:${stepIndex}`,
        propertyId: runtime.propertyId,
        occurredAt: new Date(runtime.startedAt.getTime() + step.atSimTimeMs).toISOString(),
        type: step.eventTemplate.type,
        metadata: step.eventTemplate.metadata,
        ...(device ? { deviceId: device.id } : {}),
      } as DomainEventInput;
      const result = await this.#provider.sendCommand(command);
      if (!result.accepted) {
        throw new SimulationControlError(`Simulation event rejected: ${result.reason}`);
      }
    }
  }

  async #checkpoint(runtime: Runtime): Promise<void> {
    await prisma.simulationRun.update({
      where: { id: runtime.runId },
      data: {
        status: runtime.clock.status,
        speedFactor: runtime.clock.speedFactor,
        simClockMs: Math.round(runtime.clock.simClockMs),
      },
    });
  }

  #runtimeForProperty(propertyId: string): Runtime | undefined {
    return [...this.#runtimes.values()].find(
      (runtime) => runtime.propertyId === propertyId && runtime.clock.status !== "COMPLETED",
    );
  }

  async #stopPropertyRuntime(propertyId: string, status: "COMPLETED"): Promise<void> {
    const runtime = this.#runtimeForProperty(propertyId);
    if (runtime?.timer) clearInterval(runtime.timer);
    if (runtime) {
      runtime.clock = { ...runtime.clock, status };
      await this.#checkpoint(runtime);
      this.#runtimes.delete(runtime.runId);
      await this.#provider.disconnect(propertyId);
    }
  }

  #redisKey(runId: string): string {
    return `homeguard:simulation:run:${runId}`;
  }
}

export function parseStoredScript(value: unknown) {
  return simulationScriptSchema.parse(value);
}
