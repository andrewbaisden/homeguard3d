import { verifyRealtimeToken } from "@homeguard/auth/realtime-token";
import { loadEnv, realtimeServiceEnvSchema } from "@homeguard/config/env";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { IngestionValidationError, ingestEvent } from "./ingestion/handler";
import { createRedisRealtimeBus } from "./realtime/pubsub";

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
