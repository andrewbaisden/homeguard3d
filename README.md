# HomeGuard 3D

**A smart-home digital twin and security monitoring portfolio platform.**

> HomeGuard 3D is a portfolio/demo project. It is **not** a certified alarm
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

This repository has completed Phases 1–3 of the roadmap in
`ARCHITECTURE.md` section V:

- **Phase 1** — architecture, Prisma schema, workspace scaffold, CI, docs.
- **Phase 2** — auth-gated Property/Floor/Room/Door/Window onboarding
  (`apps/web/app/(dashboard)/properties/**`).
- **Phase 3** — the realtime service's ingestion pipeline and SSE stream
  (`apps/realtime-service`): a validated, idempotent, ordering-aware
  event → device-state-projection path, provable with a manually-POSTed
  event (see `apps/realtime-service/README.md`).

Not yet implemented: 2D/3D rendering, the security state machine,
simulation, alerts/automation, and historical replay — see the phased
roadmap in `ARCHITECTURE.md` section V for what's next and in what order.

## Technology stack

- **Package manager:** pnpm (workspace monorepo)
- **Frontend:** Next.js 16 (App Router), TypeScript (strict), Tailwind CSS, shadcn/ui
- **Validation:** Zod
- **Client state:** Zustand (interaction/UI state) · **Server state:** TanStack Query
- **Database:** PostgreSQL + Prisma
- **Auth:** Better Auth (self-hosted, Postgres-backed)
- **Realtime/jobs:** Server-Sent Events, Redis, BullMQ — hosted on a separate persistent Node service
- **3D:** React Three Fiber + Drei (added in Phase 7 — not a dependency yet)
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

| Variable | Used by | Purpose |
|---|---|---|
| `DATABASE_URL` | both | Postgres connection string |
| `REDIS_URL` | both | Redis connection string |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | web | Better Auth session signing + base URL |
| `FLY_INGESTION_URL`, `FLY_SERVICE_SECRET` | web | Service-to-service call into the realtime service's ingestion endpoint |
| `NEXT_PUBLIC_REALTIME_SSE_URL` | web (client) | Where the browser opens its `EventSource` connection |
| `SENTRY_DSN` | both | Error reporting |
| `POSTHOG_KEY` | web | Product analytics (high-level events only — see Privacy below) |
| `PORT` | realtime-service | HTTP port for the service |

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
