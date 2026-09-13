# @homeguard/realtime-service

Persistent Node process deployed to Fly.io. Owns the realtime transport
(SSE), the event ingestion endpoint, BullMQ workers, and the simulation
clock — see `ARCHITECTURE.md` section U (Deployment Architecture) and
section J (Realtime Transport Decision) at the repo root.

**Status: Phase 3 — ingestion + SSE.** Implemented:

- `POST /internal/ingest` — Zod-validates a domain event, idempotently
  inserts it, runs the pure device-state reducer
  (`@homeguard/domain`'s `reduceDeviceEvent`), applies the patch, and
  publishes to Redis — all in one transaction (`src/ingestion/handler.ts`).
- `GET /realtime/:propertyId/stream` — SSE stream fed by Redis pub/sub
  (`src/realtime/pubsub.ts`). No per-viewer auth yet — see the `TODO`
  in `src/index.ts`; nothing consumes this from a browser until the
  Phase 8 2D/3D sync layer.
- `GET /healthz`.

Not yet implemented: BullMQ workers, the simulation clock (Phase 9).

## Local development

Requires `DATABASE_URL`, `REDIS_URL`, and `FLY_SERVICE_SECRET` in a
local `.env` (see the repo root `.env.example`).

```bash
pnpm --filter @homeguard/realtime-service dev
```

Manual smoke test:

```bash
curl -X POST http://localhost:8080/internal/ingest \
  -H "content-type: application/json" \
  -H "x-service-secret: $FLY_SERVICE_SECRET" \
  -d '{"eventId":"evt_1","propertyId":"...","deviceId":"...","source":"SIMULATION","occurredAt":"2026-01-01T00:00:00.000Z","type":"door.opened","metadata":{}}'
```
