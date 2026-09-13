# HomeGuard 3D

**A smart-home digital twin and security monitoring platform.**

> HomeGuard 3D is a demo project. It is **not** a certified alarm
> or professional monitoring product. It does not perform emergency
> dispatch, facial/biometric recognition, or automatic determination of
> criminal intent, and it does not guarantee property security. See
> [Privacy & Security Limitations](#privacy--security-limitations) below.

## What this is

HomeGuard renders a synchronized 2D floor plan and 3D digital twin of a
property, driven by one authoritative domain model — structural layout,
live operational device/security state, and an append-only event
history. A built-in simulation engine generates realistic household and
security events (arriving home, leaving, night mode, an intrusion,
device failure) through the **same** event pipeline a real device
integration would use, so the platform is fully demoable without any
physical hardware.

The defining experience: **open a property → see its current state →
move between 2D and 3D views → watch realtime activity → inspect any
room or device → follow events through the property → receive security
alerts → review exactly what happened.**

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full system design and
[`DECISIONS.md`](./DECISIONS.md) for the reasoning behind every major
architectural choice.

## Status

This repository has completed Phases 1–7 of the roadmap in
`ARCHITECTURE.md` section V:

- **Phase 1** — architecture, Prisma schema, workspace scaffold, CI, docs.
- **Phase 2** — auth-gated Property/Floor/Room/Door/Window onboarding
  (`apps/web/app/(dashboard)/properties/**`).
- **Phase 3** — the realtime service's ingestion pipeline and SSE stream
  (`apps/realtime-service`): a validated, idempotent, ordering-aware
  event → device-state-projection path, provable with a manually-POSTed
  event (see `apps/realtime-service/README.md`).
- **Phase 4** — Device CRUD/capabilities and a live dashboard table
  (`apps/web/app/(dashboard)/properties/[propertyId]/devices`) that
  subscribes to the Phase 3 SSE stream and applies incoming events
  through the exact same `reduceDeviceEvent` function the realtime
  service uses at ingestion — proving the "one reducer, client and
  server" principle from `ARCHITECTURE.md` section M ahead of the full
  Phase 8 sync layer.
- **Phase 5** — the security state machine (`packages/domain/src/security/stateMachine.ts`,
  99 domain tests) and zones: arm/disarm/cancel commands flow through the
  same ingestion pipeline as device events, an armed hot-zone door/motion
  trigger escalates through `ENTRY_DELAY`/`ALERT` to `ALARM` on its own
  timers, and the arm guard rejects (with an override) when hot-zone
  doors/windows are open. A full arm → intrusion → alarm → disarm cycle
  is verified live end-to-end (`apps/web/app/(dashboard)/properties/[propertyId]/{security-control,zones}*`).
- **Phase 6** — the 2D floor plan (`apps/web/app/(dashboard)/properties/[propertyId]/floor-plan`):
  an SVG rendered directly from `Room.polygon` and `Door`/`Window`
  `wallOffset` geometry, with room and device selection (mouse and
  keyboard), a click-to-place device position (a new `Device.positionX/Y`
  column), and the same live SSE + `reduceDeviceEvent` pattern as the
  Devices page for marker state/color.
- **Phase 7** — the 3D digital twin (`apps/web/app/(dashboard)/properties/[propertyId]/twin-3d`):
  a route-lazy React Three Fiber scene built from the pure
  `@homeguard/three-adapter`, with stable domain IDs, floor isolation and
  dollhouse views, room/opening/device inspection, and cheap live updates
  to device markers and linked doors. Browsers without WebGL fall back to
  the live 2D plan. Browser SSE connections now use short-lived,
  property-scoped tokens minted only after a membership check.
- **Phase 8** — shared 2D/3D operational sync via `@homeguard/state`
  (Zustand + SSE), so floor plan, twin, and dashboard read one cache.
- **Phase 9** — `SimulationProvider`, logical clock, and Normal Evening
  fixture; realtime-service run manager with Postgres checkpoints.
- **Phase 10** — Leaving Home, Night Mode, Intrusion, and Device Failure
  stories plus an authenticated simulation control page
  (`/properties/[propertyId]/simulation`) with start/pause/resume/reset
  and speed controls. Intrusion drives the real security state machine
  through normalized SIMULATION-sourced events.
- **Phase 11** — alerts/automation: pure evaluators, BullMQ action
  workers, alert lifecycle UI, and a structured rule builder.
- **Phase 12** — Redis-backed occupancy estimate (UNKNOWN/VACANT/
  OCCUPIED + confidence) with live SSE updates and dashboard indicator.
- **Phase 13** — periodic + security-mode snapshots and a historical
  replay page that folds events through the live reducers.
- **Phase 14** — Playwright journey specs + seed helper, plus Vitest
  realtime reconnect/dedup resilience coverage in CI.

See `ARCHITECTURE.md` section V for Phase 15 (future-provider hardening).

## Technology stack

- **Package manager:** pnpm (workspace monorepo)
- **Frontend:** Next.js 16 (App Router), TypeScript (strict), Tailwind CSS, shadcn/ui
- **Validation:** Zod
- **Client state:** Zustand (interaction/UI state) · **Server state:** TanStack Query
- **Database:** PostgreSQL + Prisma
- **Auth:** Better Auth (self-hosted, Postgres-backed)
- **Realtime/jobs:** Server-Sent Events, Redis, BullMQ — hosted on a separate persistent Node service
- **3D:** React Three Fiber + Drei, behind a pure structural geometry adapter
- **Testing:** Vitest, React Testing Library, Playwright
- **Code quality:** Biome, Husky, lint-staged
- **CI/CD:** GitHub Actions
- **Deployment:** Vercel (Next.js app) + Fly.io (realtime service) sharing one Postgres + one Redis
- **Observability:** Sentry, PostHog

## Monorepo layout

```
homeguard3d/
  apps/
    web/                 Next.js 16 app — UI, server actions, command APIs, auth routes
    realtime-service/     Persistent Node service (Fly.io) — SSE, ingestion, BullMQ, simulation clock
  packages/
    database/             Prisma schema + generated client, shared by both apps
    domain/                Pure domain logic: security state machine, event schemas, providers, alerts
    auth/                  Better Auth config + property-access authorization helper
    three-adapter/         Pure structural-model to 3D scene-graph adapter
    ui/                    Shared shadcn/ui-adjacent utilities (e.g. `cn`)
    config/                Shared Zod environment schemas
```

## Local setup

Prerequisites: Node 20+, pnpm 9+, Docker (for local Postgres + Redis).

```bash
pnpm install
docker compose up -d          # Postgres on :5432, Redis on :6379
cp .env.example .env          # then fill in packages/database/.env and apps/*/.env as needed
pnpm db:migrate                # applies the schema in packages/database/prisma
pnpm dev                       # starts apps/web on http://localhost:3000
```

Useful scripts (see root `package.json`):

```bash
pnpm lint          # Biome check
pnpm lint:fix      # Biome check --write
pnpm typecheck     # tsc --noEmit across the workspace
pnpm test          # Vitest across packages that have tests
pnpm build         # builds apps/web and apps/realtime-service
pnpm db:generate   # regenerate the Prisma client
pnpm db:migrate    # create/apply a migration locally
pnpm db:studio     # Prisma Studio
```

## Environment variables

See [`.env.example`](./.env.example) for the full list. Summary:

| Variable                                  | Used by          | Purpose                                                                |
| ----------------------------------------- | ---------------- | ---------------------------------------------------------------------- |
| `DATABASE_URL`                            | both             | Postgres connection string                                             |
| `REDIS_URL`                               | both             | Redis connection string                                                |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`   | web              | Better Auth session signing + base URL                                 |
| `FLY_INGESTION_URL`, `FLY_SERVICE_SECRET` | web              | Service-to-service call into the realtime service's ingestion endpoint |
| `NEXT_PUBLIC_REALTIME_SSE_URL`            | web (client)     | Where the browser opens its `EventSource` connection                   |
| `SENTRY_DSN`                              | both             | Error reporting                                                        |
| `POSTHOG_KEY`                             | web              | Product analytics (high-level events only — see Privacy below)         |
| `PORT`                                    | realtime-service | HTTP port for the service                                              |

Environment variables are validated with Zod at startup (`packages/config/src/env.ts`) rather than read ad hoc via `process.env` throughout the codebase.

## Database

PostgreSQL via Prisma. The schema lives at `packages/database/prisma/schema.prisma` and models three distinct state buckets — structural, operational, and historical — described in `ARCHITECTURE.md`. Never conflate these three when adding models or fields.

## Redis

Used for ephemeral/realtime concerns only (pub/sub fan-out, live presence estimates, BullMQ job state, simulation clock runtime state) — never as the sole store for a durable security-relevant fact. See `ARCHITECTURE.md` section I.

## Testing

- **Vitest** for domain logic: the security state machine, event reducers, alert/automation evaluators, the geometry adapter, Zod schemas.
- **React Testing Library** for components.
- **Playwright** for end-to-end journeys (monitoring, simulation, intrusion scenario).

See [`TESTING.md`](./TESTING.md) for the full strategy and how 3D rendering is tested without testing Three.js itself.

## Deployment

- **Vercel** hosts the Next.js app (UI, server actions, command APIs, the initial state fetch).
- **Fly.io** hosts a separate persistent Node service for the SSE realtime stream, event ingestion, BullMQ workers, and the simulation clock.
- Both share one Postgres instance and one Redis instance.

See `ARCHITECTURE.md` section U for the full topology and `DECISIONS.md` ADR-005 for why SSE was chosen over WebSockets.

## Privacy & Security Limitations

HomeGuard is a digital-twin **simulation and demo platform**, not a
certified security product. Specifically, it does **not**:

- replace a professional monitored alarm system or guarantee property security;
- perform emergency dispatch or notify police/fire services;
- perform facial recognition or biometric identification — occupancy is represented only as anonymous, confidence-scored presence (`UNKNOWN` / `VACANT` / `OCCUPIED`);
- record or transmit real camera video or microphone audio — camera devices in this MVP are status indicators only, backed by simulated feed placeholders;
- use AI to determine criminal intent or make automatic emergency decisions.

Simulated events are always tagged `source: SIMULATION` and are never presented as physical device data. See `DECISIONS.md` ADR-013 and `AGENTS.md` for the full privacy/security ruleset engineers and AI agents must follow when extending this codebase.

## Further reading

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system design, diagrams, deployment topology
- [`DECISIONS.md`](./DECISIONS.md) — ADRs for every major architectural choice
- [`TESTING.md`](./TESTING.md) — testing strategy
- [`AGENTS.md`](./AGENTS.md) — rules for engineers and AI coding agents working in this repo
- [`AI_ENGINEERING.md`](./AI_ENGINEERING.md) — how Claude Code was used to plan and build this project
