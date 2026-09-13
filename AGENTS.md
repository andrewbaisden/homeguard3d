# AGENTS.md — Rules for engineers and AI coding agents

This file governs how code is written in this repository, by humans and
by AI agents (including Claude Code) alike. Read `ARCHITECTURE.md` and
`DECISIONS.md` before making a non-trivial change — most "obvious"
alternatives here were already considered and rejected for a documented
reason.

## The load-bearing rules

These are the rules most likely to be violated by a well-intentioned but
context-free change. Treat them as hard constraints, not style
preferences:

1. **2D and 3D must derive from the same domain model.** Never maintain
   independent authoritative room/device state inside the 3D scene, the
   2D canvas, or any dashboard component. All three read from the same
   TanStack Query cache (structural data) and the same Zustand realtime
   store (operational data), keyed by stable domain IDs. See
   `ARCHITECTURE.md` sections K/L/M.
2. **Never change security state-machine behavior without tests.** The
   state machine (`packages/domain/src/security/stateMachine.ts`, once
   implemented in Phase 5) is a pure function with a fixed transition
   table (`ARCHITECTURE.md` section E). Any change to a transition or
   guard condition requires updating the table-driven Vitest suite in
   the same commit.
3. **Never treat simulated events as physical device events.** Every
   event's `source` field is mandatory and validated
   (`DEVICE|USER|AUTOMATION|SIMULATION|SYSTEM`). Any UI that renders an
   event, alert, or device state derived from a `SIMULATION`-sourced
   event must visibly label it as simulated. Simulation must never
   default or infer a source — it is always explicit.
4. **Never expose private property/device state through public routes.**
   Every property-scoped query or mutation must go through
   `requirePropertyAccess()` (`packages/auth`). There is no "list all
   devices" or "get property state" endpoint that skips membership
   checks, including for debugging/demo convenience.
5. **Never bypass server-side authorization for device commands.** A
   hidden or disabled UI button is not access control. Sensitive
   commands (`unlock`, `disarm`, structural edits) are re-checked
   server-side against the caller's `Role` on every request.
6. **Simulation must use the same normalized event pipeline as future
   physical-device providers.** `SimulationProvider` implements the same
   `SmartHomeProvider` interface a future Home Assistant/Matter adapter
   would, and calls the same ingestion handler — see `ARCHITECTURE.md`
   section N/O. There is no separate "fake UI" code path for demo data.
7. **No durable security-relevant fact may live only in Redis.** Redis
   is for ephemeral/realtime concerns (pub/sub, live presence, BullMQ
   state, simulation clock runtime state). If losing a piece of state on
   Redis restart would silently lose a security fact, it belongs in
   Postgres. See `ARCHITECTURE.md` section I.

## TypeScript

- Strict mode is on everywhere (`tsconfig.base.json`): `strict`,
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noUnusedLocals`/`noUnusedParameters`. Don't weaken these per-package
  without discussing it first — they exist to catch the class of bug
  most likely in a system with three synchronized state representations
  (missing-field, stale-optional bugs).
- Prefer explicit domain enums over booleans (`DoorState.OPEN` not
  `isOpen: true`) — this mirrors the product requirement that device
  state be unambiguous, and extends naturally when a third state
  (`UNKNOWN`, `JAMMED`) is needed later.
- Package boundaries matter: `packages/domain` must never import
  `@prisma/client` or perform I/O. It is pure logic, callable from both
  `apps/web` (server actions) and `apps/realtime-service` (ingestion),
  and must be unit-testable with zero mocks.

## Domain boundaries

- **Structural vs Operational vs Historical state are different
  things** (`ARCHITECTURE.md` section C). Don't add a field to `Device`
  that's really an event, and don't try to recompute operational state
  from `Event` history on every read — read the authoritative projection
  columns instead. `Event`/`Snapshot` exist for audit and replay, not as
  the primary read path.
- **The security state machine lives in one file.** Do not add arming/
  disarming/alarm logic to a server action, a React component, or an
  automation rule handler. They call into the pure state machine module
  and apply its returned effects.
- **`Event.type` is a validated string, not a Prisma enum** — the closed
  vocabulary is the Zod discriminated union in
  `packages/domain/src/events/schema.ts`. Adding a new event type means
  adding a case there, not a Prisma migration.

## Prisma / migrations

- Every migration is generated via `pnpm db:migrate` (`prisma migrate
  dev`) and committed under `packages/database/prisma/migrations/` —
  never hand-edit the database out of band.
- Structural changes (new Room/Device/Zone fields) are rare and go
  through a migration; operational-state columns on `Device` are
  written only by the ingestion reducer, never by ad hoc `prisma.device.update()` calls scattered through route handlers.
- Don't add nullable columns "just in case." If a field isn't populated
  by any Phase currently being built, it doesn't belong in the schema
  yet — extend the schema when the feature that needs it is built.

## Realtime

- The Fly.io realtime service (`apps/realtime-service`) is the only
  process that runs the event reducer and writes operational-state
  projections. The Vercel app never mutates `Device`/`SecurityState`
  columns directly — it calls the realtime service's internal ingestion
  endpoint, authenticated by `FLY_SERVICE_SECRET`. This is a hard rule,
  not an optimization to revisit: violating it creates split-brain state
  writes (see `DECISIONS.md` ADR-005, risk #1 in `ARCHITECTURE.md`
  section W).
- SSE clients must degrade gracefully on disconnect: show a clear "last
  known state as of X" indicator, never silently freeze.

## Simulation

- Simulation scenarios are deterministic given a seed — don't introduce
  unseeded `Math.random()` calls in scenario scripts; use the shared
  seeded PRNG.
- The simulation clock is logical, decoupled from wall-clock time. Don't
  use `setTimeout`/`Date.now()` directly in scenario logic — use the
  clock abstraction so pause/resume/speed controls work correctly.

## Security / privacy

- No biometric or facial-recognition fields, ever. Occupancy is
  `UNKNOWN`/`VACANT`/`OCCUPIED` plus a confidence score — never an
  identified individual.
- Camera devices never store a real stream URL or video bytes in this
  MVP. `cameraState` is a status enum; the UI renders a placeholder.
- PostHog receives only an explicit allowlist of product-level event
  names (see `ARCHITECTURE.md` section S) — never raw domain events,
  occupancy data, or device state.
- Sentry's `beforeSend` must strip event `metadata` payloads and any
  room/device-correlatable movement data before reporting.

## Testing

- A change to `packages/domain` requires a corresponding Vitest test in
  the same commit — this package has no I/O, so there's no excuse for
  an untested pure function.
- A change affecting how 2D or 3D renders operational state should
  include or update a state-synchronization test (`domain projection ==
  2D rendered state == 3D scene userData state`) once that harness
  exists (Phase 8+).
- See `TESTING.md` for the full strategy.

## Dependency policy

- Don't add a dependency for something the standard library, an
  existing dependency, or a few lines of code already covers.
- New dependencies should map to an explicit phase/need in
  `ARCHITECTURE.md` section V. Three.js/React Three Fiber, for example,
  is deliberately **not** installed yet (Phase 7) — don't add it early
  "to get started," since it inflates the bundle for every route until
  the 3D view actually exists.
- Pin exact or narrow version ranges for anything security- or
  auth-adjacent (Better Auth, its Prisma adapter).

## Commit conventions

Use Conventional Commits, scoped to the area changed:

```
feat(twin): add structured property model
feat(security): add security mode state machine
fix(events): reject duplicate device event
refactor(twin): isolate geometry adapter
perf(viewer): update device state without rebuilding scene
test(security): add alarm transition tests
chore: configure github actions
docs: document digital twin architecture
```

Keep commits logically scoped — a schema change and a UI change that
happen to touch the same feature are still two commits.
