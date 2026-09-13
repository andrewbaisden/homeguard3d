# @homeguard/realtime-service

Persistent Node process deployed to Fly.io. Owns the realtime transport
(SSE), the event ingestion endpoint, BullMQ workers, and the simulation
clock — see `ARCHITECTURE.md` section U (Deployment Architecture) and
section J (Realtime Transport Decision) at the repo root.

**Status: Phase 9–11 — ingestion, SSE, security, simulation, and
alerts/automation (BullMQ action workers).**
Implemented:

- `POST /internal/ingest` — Zod-validates a domain event and routes it
  one of two ways (`src/ingestion/handler.ts`):
  - **Device events** (door/lock/motion/camera/connectivity): idempotent
    insert, the pure `reduceDeviceEvent` reducer, patch the `Device`
    row. If the property is `ARMED` and the device sits in a zone hot
    for the current mode, this also derives a `security.sensor_triggered`
    event and runs the state machine (see below).
  - **Security events** (`security.arm_requested`/`arm_cancelled`/
    `disarmed`/the timer-expiry events): computes the zone snapshot the
    arm guard needs (`src/security/zones.ts`), runs the pure
    `transition()` from `@homeguard/domain`, and patches `SecurityState`.
    A rejected arm attempt (open hot-zone doors, no override) is never
    persisted as an Event.
  - Both paths publish to Redis and schedule any `SCHEDULE_TIMER`/
    `CANCEL_TIMERS` effects (`src/security/timers.ts`) — **in-memory only**,
    lost on restart; a stand-in for durable BullMQ delayed jobs (Phase 11).
- `GET /realtime/:propertyId/stream` — SSE stream fed by Redis pub/sub
  (`src/realtime/pubsub.ts`), CORS-scoped to `WEB_APP_ORIGIN` and gated by
  a short-lived, property-scoped token minted only after `requireAccess`.
- `GET /healthz`.

- `GET /internal/simulation/:propertyId` and
  `POST /internal/simulation/:propertyId/control` — service-authenticated
  simulation status and logical-clock controls. Runs are durable in
  Postgres, high-frequency clock state is held in Redis, and every step
  enters through the same `ingestEvent` pipeline with `source: SIMULATION`.

Not yet implemented: Playwright E2E (Phase 14).

## Local development

Requires `DATABASE_URL`, `REDIS_URL`, `FLY_SERVICE_SECRET`, and
`WEB_APP_ORIGIN` in a local `.env` (see the repo root `.env.example`).

```bash
pnpm --filter @homeguard/realtime-service dev
```

Manual smoke test (device event):

```bash
curl -X POST http://localhost:8080/internal/ingest \
  -H "content-type: application/json" \
  -H "x-service-secret: $FLY_SERVICE_SECRET" \
  -d '{"eventId":"evt_1","propertyId":"...","deviceId":"...","source":"SIMULATION","occurredAt":"2026-01-01T00:00:00.000Z","type":"door.opened","metadata":{}}'
```

Manual smoke test (arm — normally sent by apps/web's `security-actions.ts`):

```bash
curl -X POST http://localhost:8080/internal/ingest \
  -H "content-type: application/json" \
  -H "x-service-secret: $FLY_SERVICE_SECRET" \
  -d '{"eventId":"evt_2","propertyId":"...","source":"USER","occurredAt":"2026-01-01T00:00:00.000Z","type":"security.arm_requested","metadata":{"mode":"AWAY","override":false}}'
```
