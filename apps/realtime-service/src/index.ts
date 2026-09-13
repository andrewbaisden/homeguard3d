import { verifyRealtimeToken } from "@homeguard/auth/realtime-token";
import { loadEnv, realtimeServiceEnvSchema } from "@homeguard/config/env";
import { simulationControlSchema } from "@homeguard/domain";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import {
  IngestionValidationError,
  ingestEvent,
  setAutomationQueue,
  setOccupancyStore,
} from "./ingestion/handler";
import { createAutomationQueue, startAutomationWorker } from "./jobs/automation-worker";
import { OccupancyStore } from "./occupancy/store";
import { createRedisRealtimeBus } from "./realtime/pubsub";
import { SimulationControlError, SimulationManager } from "./simulation/manager";

/**
 * HomeGuard realtime service — the persistent Node process deployed to
 * Fly.io. Owns ingestion, SSE, security timers, simulation clock, and
 * BullMQ automation action workers.
 */

const env = loadEnv(realtimeServiceEnvSchema);
const bus = createRedisRealtimeBus(env.REDIS_URL);
const automationQueue = createAutomationQueue(env.REDIS_URL);
setAutomationQueue(automationQueue);
const occupancy = new OccupancyStore(env.REDIS_URL);
setOccupancyStore(occupancy);
const automationWorker = startAutomationWorker(env.REDIS_URL, bus);
automationWorker.on("failed", (job, error) => {
  console.error("[automation] job failed", job?.id, error);
});

const simulations = new SimulationManager(env.REDIS_URL, bus);
void simulations.initialize().catch((error) => {
  console.error("[simulation] failed to restore running simulations", error);
});

const app = new Hono();

app.get("/healthz", (c) => c.text("ok"));

app.post("/internal/ingest", async (c) => {
  const secret = c.req.header("x-service-secret");
  if (secret !== env.FLY_SERVICE_SECRET) {
    return c.json({ error: "unauthorized" }, 401);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  try {
    const result = await ingestEvent(body, bus);
    return c.json(result, 200);
  } catch (error) {
    if (error instanceof IngestionValidationError) {
      return c.json({ error: "validation_failed", message: error.message }, 400);
    }
    console.error("[ingest] unexpected error", error);
    return c.json({ error: "internal_error" }, 500);
  }
});

app.get("/internal/simulation/:propertyId", async (c) => {
  if (c.req.header("x-service-secret") !== env.FLY_SERVICE_SECRET) {
    return c.json({ error: "unauthorized" }, 401);
  }
  return c.json(await simulations.status(c.req.param("propertyId")));
});

app.get("/internal/occupancy/:propertyId", async (c) => {
  if (c.req.header("x-service-secret") !== env.FLY_SERVICE_SECRET) {
    return c.json({ error: "unauthorized" }, 401);
  }
  return c.json(await occupancy.get(c.req.param("propertyId")));
});

app.post("/internal/simulation/:propertyId/control", async (c) => {
  if (c.req.header("x-service-secret") !== env.FLY_SERVICE_SECRET) {
    return c.json({ error: "unauthorized" }, 401);
  }
  const parsed = simulationControlSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_control" }, 400);
  const propertyId = c.req.param("propertyId");
  try {
    switch (parsed.data.action) {
      case "start":
        await simulations.start(propertyId, parsed.data.scenarioKey, parsed.data.speedFactor);
        break;
      case "pause":
        await simulations.pause(propertyId);
        break;
      case "resume":
        await simulations.resume(propertyId);
        break;
      case "reset":
        await simulations.reset(propertyId);
        break;
      case "speed":
        await simulations.setSpeed(propertyId, parsed.data.speedFactor);
        break;
    }
    return c.json(await simulations.status(propertyId));
  } catch (error) {
    if (error instanceof SimulationControlError) {
      return c.json({ error: "simulation_rejected", message: error.message }, 409);
    }
    throw error;
  }
});

app.use("/realtime/*", cors({ origin: env.WEB_APP_ORIGIN }));
app.get("/realtime/:propertyId/stream", (c) => {
  const propertyId = c.req.param("propertyId");
  const token = c.req.query("token");
  if (!verifyRealtimeToken(token, propertyId, env.FLY_SERVICE_SECRET)) {
    return c.json({ error: "unauthorized" }, 401);
  }

  return streamSSE(c, async (stream) => {
    const unsubscribe = bus.subscribe(propertyId, (payload) => {
      void stream.writeSSE({ data: JSON.stringify(payload) });
    });

    await new Promise<void>((resolve) => {
      stream.onAbort(() => {
        unsubscribe();
        resolve();
      });
    });
  });
});

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`[homeguard-realtime-service] listening on :${info.port}`);
});
