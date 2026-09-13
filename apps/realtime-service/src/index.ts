import { verifyRealtimeToken } from "@homeguard/auth/realtime-token";
import { loadEnv, realtimeServiceEnvSchema } from "@homeguard/config/env";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { IngestionValidationError, ingestEvent } from "./ingestion/handler";
import { createRedisRealtimeBus } from "./realtime/pubsub";
import { SimulationControlError, SimulationManager } from "./simulation/manager";

/**
 * HomeGuard realtime service — the persistent Node process deployed to
 * Fly.io. See ARCHITECTURE.md section U/J for the full split with the
 * Vercel app.
 *
 * Phase 3 scope: the ingestion endpoint and SSE stream, provable with a
 * manually-POSTed test event. BullMQ workers and the simulation clock
 * are wired in later phases (see ARCHITECTURE.md section V).
 */

const env = loadEnv(realtimeServiceEnvSchema);
const bus = createRedisRealtimeBus(env.REDIS_URL);
const simulations = new SimulationManager(env.REDIS_URL, bus);
void simulations.initialize().catch((error) => {
  console.error("[simulation] failed to restore running simulations", error);
});

const app = new Hono();

app.get("/healthz", (c) => c.text("ok"));

// Internal, service-to-service only — the Vercel app calls this after
// authorizing the end user; end-user auth never reaches this process.
// See ARCHITECTURE.md section J and R.
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

const simulationControlSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    scenarioKey: z.string().min(1),
    speedFactor: z.number().min(0.25).max(8).default(1),
  }),
  z.object({ action: z.literal("pause") }),
  z.object({ action: z.literal("resume") }),
  z.object({ action: z.literal("reset") }),
  z.object({ action: z.literal("speed"), speedFactor: z.number().min(0.25).max(8) }),
]);

app.get("/internal/simulation/:propertyId", async (c) => {
  if (c.req.header("x-service-secret") !== env.FLY_SERVICE_SECRET) {
    return c.json({ error: "unauthorized" }, 401);
  }
  return c.json(await simulations.status(c.req.param("propertyId")));
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

// Direct browser-facing SSE stream (see ARCHITECTURE.md section J: opened
// directly against this service, not proxied through Vercel). Vercel and
// Fly.io are always different origins, so this needs CORS even though
// both endpoints live on "the same app" conceptually.
//
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
