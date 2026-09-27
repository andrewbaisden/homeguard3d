# Development

Contributor and implementation notes for HomeGuard 3D. For a product overview, installation, and responsible-use limits, see [`README.md`](./README.md).

## Status

Version **0.1.0**. Phases 1–15 of the roadmap in [`ARCHITECTURE.md`](./ARCHITECTURE.md) section V are implemented:

- **Phase 1** — architecture, Prisma schema, workspace scaffold, CI, docs.
- **Phase 2** — auth-gated Property/Floor/Room/Door/Window onboarding (`apps/web/app/(dashboard)/properties/**`).
- **Phase 3** — the realtime service's ingestion pipeline and SSE stream (`apps/realtime-service`): a validated, idempotent, ordering-aware event → device-state-projection path, provable with a manually-POSTed event (see [`apps/realtime-service/README.md`](./apps/realtime-service/README.md)).
- **Phase 4** — Device CRUD/capabilities and a live dashboard table (`apps/web/app/(dashboard)/properties/[propertyId]/devices`) that subscribes to the Phase 3 SSE stream and applies incoming events through the same `reduceDeviceEvent` function the realtime service uses at ingestion.
- **Phase 5** — the security state machine (`packages/domain/src/security/stateMachine.ts`) and zones: arm/disarm/cancel commands flow through the same ingestion pipeline as device events. An armed hot-zone door or motion trigger escalates through `ENTRY_DELAY` / `ALERT` to `ALARM`. The arm guard rejects (with an override) when hot-zone doors or windows are open.
- **Phase 6** — the 2D floor plan (`.../floor-plan`): an SVG rendered from `Room.polygon` and `Door` / `Window` `wallOffset` geometry, with room and device selection, click-to-place device positions, and live marker state.
- **Phase 7** — the 3D digital twin (`.../twin-3d`): a route-lazy React Three Fiber scene built from `@homeguard/three-adapter`, with floor isolation, dollhouse view, and inspection. Browsers without WebGL fall back to the live 2D plan. Browser SSE connections use short-lived, property-scoped tokens minted only after a membership check.
- **Phase 8** — shared 2D/3D operational sync via `@homeguard/state` (Zustand + SSE), so floor plan, twin, and dashboard read one cache.
- **Phase 9** — `SimulationProvider`, logical clock, and Normal Evening fixture; realtime-service run manager with Postgres checkpoints.
- **Phase 10** — Leaving Home, Night Mode, Intrusion, and Device Failure stories, plus an authenticated simulation control page (`.../simulation`) with start, pause, resume, reset, and speed controls.
- **Phase 11** — alerts and automation: pure evaluators, BullMQ action workers, alert lifecycle UI, and a structured rule builder.
- **Phase 12** — Redis-backed occupancy estimate (`UNKNOWN` / `VACANT` / `OCCUPIED` plus confidence) with live SSE updates.
- **Phase 13** — periodic and security-mode snapshots, and a historical replay page that folds events through the live reducers.
- **Phase 14** — Playwright journey specs and seed helper, plus Vitest realtime reconnect/dedup coverage in CI.
- **Phase 15** — `HomeAssistantProvider` stub implementing the same `SmartHomeProvider` interface as simulation. Entity mapping helpers exist; the command path returns `NOT_IMPLEMENTED` and there is no live Home Assistant I/O.

Later hardening beyond the stub is described in `ARCHITECTURE.md` section V.

## Technology stack

- **Package manager:** pnpm (workspace monorepo)
- **Frontend:** Next.js 16 (App Router), TypeScript (strict), Tailwind CSS, shadcn/ui
- **Validation:** Zod
- **Client state:** Zustand (interaction and UI) · **Server state:** TanStack Query
- **Database:** PostgreSQL + Prisma
- **Auth:** Better Auth (self-hosted, Postgres-backed)
- **Realtime and jobs:** Server-Sent Events, Redis, BullMQ, on a separate persistent Node service
- **3D:** React Three Fiber + Drei, behind a pure structural geometry adapter
- **Testing:** Vitest, React Testing Library, Playwright
- **Code quality:** Biome, Husky, lint-staged
- **CI/CD:** GitHub Actions
- **Deployment:** Vercel (Next.js app) + Fly.io (realtime service), sharing one Postgres and one Redis
- **Observability:** Sentry, PostHog

## Monorepo layout

```
homeguard3d/
  apps/
    web/                  Next.js 16 app — UI, server actions, command APIs, auth routes
    realtime-service/     Persistent Node service — SSE, ingestion, BullMQ, simulation clock
  packages/
    database/             Prisma schema + generated client, shared by both apps
    domain/               Pure domain logic: security state machine, event schemas, providers, alerts
    auth/                 Better Auth config + property-access authorization helper
    three-adapter/        Pure structural-model to 3D scene-graph adapter
    ui/                   Shared UI utilities (for example `cn`)
    config/               Shared Zod environment schemas
```

## Scripts

```bash
pnpm lint          # Biome check
pnpm lint:fix      # Biome check --write
pnpm typecheck     # tsc --noEmit across the workspace
pnpm test          # Vitest across packages that have tests
pnpm build         # builds apps/web and apps/realtime-service
pnpm db:generate   # regenerate the Prisma client
pnpm db:migrate    # create/apply a migration locally
pnpm db:studio     # Prisma Studio
pnpm db:seed:demo  # seed demo user + 2-floor furnished home
```

Playwright journeys live in `apps/web`:

```bash
pnpm --filter @homeguard/web e2e
```

## Environment variables

Copy [`.env.example`](./.env.example) to the places each process actually reads:

| File | Read by |
| --- | --- |
| `packages/database/.env` | Prisma CLI and `pnpm db:seed:demo` |
| `apps/web/.env.local` | Next.js |
| `apps/realtime-service/.env` | Load into the shell before `pnpm --filter @homeguard/realtime-service dev` (tsx does not read `.env` on its own) |

| Variable | Used by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | both | Postgres connection string |
| `REDIS_URL` | both | Redis connection string |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | web | Better Auth session signing and base URL |
| `FLY_INGESTION_URL`, `FLY_SERVICE_SECRET` | web, realtime | Service-to-service call into the ingestion endpoint |
| `NEXT_PUBLIC_REALTIME_SSE_URL` | web (client) | Where the browser opens its `EventSource` |
| `WEB_APP_ORIGIN` | realtime | CORS origin allowed to open the SSE stream |
| `SENTRY_DSN` | both | Error reporting |
| `POSTHOG_KEY` | web | Product analytics (allowlisted event names only) |
| `PORT` | realtime | HTTP port (default `8080`) |

`BETTER_AUTH_SECRET` must be at least 32 characters. `FLY_SERVICE_SECRET` must be at least 16. Values are validated with Zod at startup in `packages/config/src/env.ts`.

Demo seed overrides: `DEMO_EMAIL`, `DEMO_PASSWORD`, `DEMO_NAME`, `DEMO_PROPERTY_NAME`, `DEMO_TIMEZONE`, and `DEMO_RESET=1`.

## Database

PostgreSQL via Prisma. The schema is `packages/database/prisma/schema.prisma`. It models structural, operational, and historical state as separate concerns — see `ARCHITECTURE.md`. Generate migrations with `pnpm db:migrate`. Do not edit the database out of band.

## Redis

Redis holds ephemeral realtime state only: pub/sub fan-out, live presence estimates, BullMQ job state, and simulation clock runtime. A security-relevant fact that must survive a Redis restart belongs in Postgres. See `ARCHITECTURE.md` section I.

## Realtime service

`pnpm dev` starts only the Next.js app. Live updates, ingestion, simulation, and alert workers need the second process:

```bash
set -a
source apps/realtime-service/.env
set +a
pnpm --filter @homeguard/realtime-service dev
```

The service listens on port `8080`. Details and manual ingest examples are in [`apps/realtime-service/README.md`](./apps/realtime-service/README.md).

## Testing

- **Vitest** for domain logic: the security state machine, event reducers, alert evaluators, the geometry adapter, and Zod schemas.
- **React Testing Library** for components.
- **Playwright** for monitoring, simulation, and intrusion journeys.

See [`TESTING.md`](./TESTING.md).

## Deployment

- **Vercel** hosts the Next.js app (UI, server actions, command APIs, the initial state fetch).
- **Fly.io** hosts the persistent Node service (SSE, event ingestion, BullMQ workers, simulation clock).
- Both share one Postgres instance and one Redis instance.

Topology is in `ARCHITECTURE.md` section U. The choice of SSE over WebSockets is ADR-005 in [`DECISIONS.md`](./DECISIONS.md).

## Further reading

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system design and deployment topology
- [`DECISIONS.md`](./DECISIONS.md) — architecture decision records
- [`TESTING.md`](./TESTING.md) — testing strategy
- [`AGENTS.md`](./AGENTS.md) — rules for engineers and AI coding agents
- [`AI_ENGINEERING.md`](./AI_ENGINEERING.md) — how the project was planned and built
