# ARCHITECTURE.md

This document describes HomeGuard 3D's system architecture: the digital
twin domain model, how structural/operational/historical state are kept
distinct, the event pipeline, realtime transport, 2D/3D rendering and
synchronization, the device provider abstraction, simulation, security,
and deployment. For _why_ each choice was made over the alternatives,
see [`DECISIONS.md`](./DECISIONS.md).

**Status:** this describes the target architecture. As of Phase 1, the
Prisma schema, workspace scaffold, and documentation exist; the domain
logic, rendering, realtime pipeline, and simulation engine described
below are built incrementally in the phases listed in section V.

---

## Core principle: One Home Model, Multiple Views

```
                  Home Digital Twin
                         │
            ┌────────────┼────────────┐
            │            │            │
            ▼            ▼            ▼
         2D View      3D View      Device UI
            │            │            │
            └────────────┼────────────┘
                         │
                    Realtime State
```

The 2D plan and 3D environment are never independent copies of the home.
Both derive from the same structured domain model and the same live
operational-state store. If the front door is `OPEN`, the 2D view, the
3D view, the device panel, and the security dashboard all represent
that same fact — none of them independently manages door state.

## A. Digital Twin Domain

Three distinct state buckets — do not conflate them (see
[`DECISIONS.md`](./DECISIONS.md) ADR-002):

| Bucket            | What              | Examples                                                                           |
| ----------------- | ----------------- | ---------------------------------------------------------------------------------- |
| **Structural**    | Relatively static | Property, Floor, Room, Wall (implicit), Door, Window, device placement             |
| **Operational**   | Current state     | Door open/closed, lock state, motion active/inactive, camera online, security mode |
| **Event History** | What changed      | door.opened, motion.started, security.armed, alarm.triggered                       |

Core entities: `Property` (tenant root) → `Floor` → `Room` (polygon
geometry) → `Door`/`Window` (wall-offset geometry, optionally linked to
a `Device`). `Device` is provider-neutral with capability rows and typed
current-state columns. `SecurityZone` groups rooms/doors/windows/devices
and maps to `SecurityMode`s. `SecurityState` is one authoritative row
per property holding the state machine's current node. `Event` is the
append-only historical ledger everything else derives from. `Alert` and
`AutomationRule` are derived/reactive. `SimulationScenario`/
`SimulationRun` are deterministic seeded scripts. `Snapshot` supports
historical replay. `Membership` (User↔Property, `Role`) gates all
access.

**Deliberately not modeled (yet):**

- **No standalone `Wall` table.** Walls are implied by each `Room`'s
  `polygon` (an ordered vertex loop); `Door`/`Window` reference a wall
  by segment index + offset. A dedicated table would only earn its keep
  once walls need independent material/thickness/damage attributes.
- **No `Camera` table.** A camera is a `Device` with the `VIDEO`
  capability, not a distinct entity.
- **No `Incident` table.** `Alert` already carries enough for MVP;
  clustering related alerts into an incident story is a later-phase
  concern.
- **No per-provider config tables.** Deferred until a second real
  provider exists beyond simulation.

## B. Prisma Schema

The full schema lives at `packages/database/prisma/schema.prisma`.
Summary of the model groups (see the file itself for exact fields/
relations/indexes):

- **Identity & access:** `User`, `Session`, `Account`, `Verification`
  (Better Auth adapter tables), `Membership` (role-gated property
  access).
- **Structural:** `Property`, `Floor`, `Room`, `Door`, `Window`.
- **Devices:** `Device` (typed nullable current-state columns —
  `doorState`, `lockState`, `motionState`, `cameraState`, `batteryPct`,
  `tempC`, `humidityPct` — plus `connectivity`, `lastSeenAt`,
  `offlineThresholdSec`), `DeviceCapability`.
- **Security:** `SecurityState` (mode + state-machine node),
  `SecurityZone`, `ZoneRoom`, `ZoneDevice`, `ZoneModeActivation`.
- **Events & alerts:** `Event` (append-only), `Alert`, `AutomationRule`.
- **Simulation & replay:** `SimulationScenario`, `SimulationRun`,
  `Snapshot`.

Key modeling decisions (rationale in `DECISIONS.md`):

- `Event.type` is a validated `String`, not a Prisma enum — the closed
  vocabulary is enforced by a Zod discriminated union in
  `packages/domain`, so new event types (future providers, new phases)
  never require a schema migration.
- Device current-state is typed nullable **columns on `Device`**, not
  per-category subtype tables or a generic key/value table — see
  section D.
- `offlineThresholdSec` is a **per-device column**, not a global
  constant — a battery contact sensor and a mains-powered camera have
  different legitimate silence windows.

## C. Structural vs Operational vs Historical State

| Bucket      | Models/fields                                                                                   | Mutation pattern                                                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Structural  | `Property`, `Floor`, `Room`, `Door`, `Window`, `Device` identity fields, `SecurityZone` + joins | Rare, via authenticated admin server actions                                                                                        |
| Operational | `Device` status columns, `SecurityState`, live `PresenceEstimate` (Redis)                       | **Authoritative projection** — written synchronously by a pure reducer inside the same transaction as the triggering `Event` insert |
| Historical  | `Event` (immutable, append-only), `Snapshot`, `Alert` lifecycle timestamps                      | Never mutated in place except `Alert.status` (itself also emitted as an `Event`)                                                    |

Operational state is "the event log folded forward," but the fold
happens once at write time (`reduceEvent(currentRow, event) -> patch`),
not recomputed on every read:

```
Events
  ↓
Reducer (pure, runs once at ingestion)
  ↓
Current State Projection (Postgres columns, read directly)
```

This is why HomeGuard does **not** implement full event sourcing (see
`DECISIONS.md` ADR-003): replay-on-read would make every dashboard/2D/3D
query O(history). Instead, Postgres operational columns are a
continuously-updated materialized fold, with `Event`/`Snapshot` retained
underneath for audit and replay.

## D. Device / Capability Model

Provider-neutral device categories: `CAMERA`, `LOCK`, `CONTACT_SENSOR`,
`MOTION_SENSOR`, `ENV_SENSOR`, `SIREN`, `HUB`. Capabilities (`LOCK`,
`CONTACT`, `MOTION`, `VIDEO`, `AUDIO`, `BATTERY`, `TEMPERATURE`,
`HUMIDITY`, `SMOKE`) describe what a device instance _can_ do,
decoupled from its current state.

**Decision: typed nullable columns on `Device`**, not per-category
subtype tables and not a generic key/value state table.

- Per-category subtype tables (`LockDevice`, `CameraDevice`, ...) force
  either a join per device read across every mixed-category list (2D,
  3D, dashboard, automation all read arbitrary mixed-category device
  lists on every realtime tick) or an awkward supertype+subtype join
  pattern.
- A generic key/value table loses type safety and cannot express typed
  enums (`DoorState` vs `LockState`), directly contradicting the
  "explicit domain states over generic booleans" requirement.

Only the columns matching a device's assigned `capabilities` are ever
populated — enforced by the ingestion reducer and covered by unit
tests, not a database constraint (Postgres has no clean way to express
"this column is only valid given this capability" declaratively without
brittleness as the capability list grows).

Connectivity states: `ONLINE → STALE → OFFLINE` (plus `UNKNOWN`),
demoted by a background sweep job comparing `now - lastSeenAt` against
each device's own `offlineThresholdSec`. Every demotion emits a
`device.stale`/`device.offline` event — connectivity loss is auditable
history, never a silent side effect.

## E. Security State Machine

States: `IDLE_DISARMED`, `EXIT_DELAY`, `ARMED`, `ENTRY_DELAY`, `ALERT`,
`ALARM`, `DISARMING`.

```
IDLE_DISARMED --user.arm(mode)--> EXIT_DELAY
   [zone-relevant openings closed, or explicit override ack]

EXIT_DELAY --timer.expires--> ARMED
EXIT_DELAY --user.cancelArm--> IDLE_DISARMED

ARMED --sensor.trigger(entry point, hot zone)--> ENTRY_DELAY
ARMED --sensor.trigger(non-entry, hot zone)--> ALERT

ENTRY_DELAY --timer.expires--> ALARM
ENTRY_DELAY --user.disarm(valid credential)--> DISARMING --> IDLE_DISARMED

ALERT --user.disarm--> DISARMING --> IDLE_DISARMED
ALERT --timer.graceExpires--> ALARM

ALARM --user.disarm(valid credential)--> DISARMING --> IDLE_DISARMED
   [always allowed — never lock a user out of disarming their own alarm]
```

**Placement:** one pure module,
`packages/domain/src/security/stateMachine.ts` —
`transition(current, event, zoneSnapshot) -> { next, effects }`. No I/O,
no Prisma import, fully Vitest-table-testable. This is the single
"never change without tests" boundary in the app (see `AGENTS.md`). The
UI never calls this directly — it dispatches intents (`armSecurity(mode)`,
`disarmSecurity()`) via server actions, which call this module and then
persist the result.

## F. Security Zone Model

`SecurityZone` groups `Room`s (`ZoneRoom`) and `Device`s (`ZoneDevice`).
`ZoneModeActivation(zoneId, mode)` marks which zones are "hot"
(arm-relevant) for a given `SecurityMode`:

- **AWAY** activates `PERIMETER + GROUND_FLOOR + UPSTAIRS + GARAGE`.
- **NIGHT** activates `PERIMETER` only, so upstairs occupant motion
  doesn't trigger the alarm.
- **HOME** activates perimeter openings only; interior motion is
  disabled.

This mapping is **data**, editable per property without a deploy. The
_interpretation_ of a hot-zone trigger stays in the pure state-machine
module (E), which takes a precomputed `ZoneSnapshot` as a plain input
rather than querying zones itself — keeping the state machine free of
I/O and fully unit-testable.

## G. Event Model

Zod discriminated union in `packages/domain/src/events/schema.ts`.
Common envelope:

```ts
{
  eventId: string;        // idempotency key (ULID), provider-generated
  propertyId: string;
  deviceId?: string;
  roomId?: string;
  entityId?: string;      // generic cross-reference (occupant, alert, ...)
  source: "DEVICE" | "USER" | "AUTOMATION" | "SIMULATION" | "SYSTEM";
  sequence?: number;      // per (propertyId, deviceId) monotonic counter
  occurredAt: string;     // ISO datetime, provider/device-asserted
  type: string;           // e.g. "door.opened" — see Prisma schema comment
  metadata: Record<string, unknown>;  // per-type shape, itself Zod-validated
}
```

- **Idempotency:** `eventId` is a unique DB constraint. Ingestion
  upserts-or-ignores on it — duplicate delivery (at-least-once retries)
  is a no-op.
- **Ordering:** `sequence` is per-(propertyId, deviceId) monotonic.
  Late/out-of-order events are stored in history unconditionally, but
  only reproject operational state if newer than the device's
  last-applied sequence.
- **`entityId`** is the escape hatch for referencing non-device objects
  (an occupant, an alert being resolved) without widening the envelope
  per new entity type.

Realtime pipeline, end to end:

```
Device / Simulator (a SmartHomeProvider)
        ↓
Event Ingestion (Fly.io realtime service)
        ↓
Zod Validation
        ↓
Normalisation
        ↓
Domain Processing (pure reducer)
        ↓
Current State (Postgres, same transaction)
        ↓
Realtime Broadcast (Redis pub/sub → SSE)
        ↓
2D / 3D / Dashboard (Zustand realtime store)
```

## H. Current-State Projection Strategy

**Synchronous reducer on ingestion**, not a background job:

1. Validate the envelope with Zod.
2. Open one Postgres transaction.
3. Insert the `Event` row (idempotent on `eventId`).
4. Run the pure reducer for that `type`.
5. Apply the resulting patch to `Device`/`SecurityState` in the same
   transaction.
6. Commit.
7. Publish the post-commit state (not the raw event) to Redis pub/sub
   for realtime fan-out.

Security/safety-relevant state must be read-your-writes consistent for
the very next dashboard query or 2D/3D re-render — introducing queue
latency between "device reported" and "dashboard shows it" is
unacceptable for the platform's core value proposition. BullMQ is
reserved for genuinely async side effects that don't block correctness:
notification delivery, automation _action_ execution, the connectivity
sweep, snapshot generation, and simulation tick scheduling. Trigger
_evaluation_ for alerts/automations still runs synchronously in the same
reducer pass, since conditions need current state.

## I. PostgreSQL vs Redis Responsibilities

| Concern                                                                                                            | Store                                                             | Why                                                                         |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Structural model, operational state, event history, alerts, automation rules, simulation scenarios/runs, snapshots | **Postgres**                                                      | Durable source of truth                                                     |
| Live occupancy/presence estimate                                                                                   | **Redis** (TTL-decayed)                                           | Ephemeral, high-churn; Postgres gets periodic rollups only                  |
| Pub/sub fan-out of post-commit state                                                                               | **Redis**                                                         | Not durable by design — clients reconcile via a snapshot fetch on reconnect |
| BullMQ job/queue state                                                                                             | **Redis**                                                         | Native BullMQ storage; jobs are retryable side effects, not source of truth |
| Realtime connection/session registry                                                                               | **Redis**                                                         | Routes pub/sub messages to the right SSE streams; ephemeral                 |
| Simulation clock runtime tick state                                                                                | **Redis**, checkpointed to `SimulationRun.simClockMs` in Postgres | High-frequency; Postgres holds the resumable checkpoint                     |
| Rate limiting / automation debounce                                                                                | **Redis**                                                         | Ephemeral, TTL-based                                                        |

**Hard rule:** no durable security-relevant fact may live only in
Redis. Anything Redis holds must either be reconstructible from
Postgres or be genuinely disposable.

## J. Realtime Transport

**Decision: Server-Sent Events (SSE) for server→client, plain
authenticated HTTP for client→server.** No WebSocket.

The platform's realtime need is overwhelmingly one-directional: devices
and simulation push state changes; clients passively receive them to
re-render 2D/3D/dashboard. The few client→server interactions (arm/
disarm, simulation start/pause/speed, lock/unlock) are discrete commands
that map cleanly onto ordinary authenticated HTTP requests, which
themselves get validated, authorized, and turned into Events through the
same ingestion path as anything else — they don't need a persistent
duplex socket. SSE also gets automatic reconnection from the browser's
`EventSource` API for free and needs no special infrastructure.

**Split across runtimes:**

- **Vercel (`apps/web`)** hosts the UI, all authenticated server
  actions/API routes for commands (arm/disarm, lock/unlock, structural
  CRUD, simulation control), and the initial full-state fetch
  (`GET /api/properties/:id/state`). Vercel does not hold open
  long-lived connections.
- **Fly.io (`apps/realtime-service`)** hosts the SSE endpoint
  (`GET /realtime/:propertyId/stream`), the internal ingestion endpoint,
  the BullMQ workers, and the simulation clock/engine.
- Vercel never runs the reducer itself. Command endpoints call the
  realtime service's internal ingestion endpoint over an authenticated
  service-to-service call (`FLY_SERVICE_SECRET`) — guaranteeing exactly
  one process ever writes operational-state projections (no
  split-brain).
- Postgres and Redis are both provisioned independently (e.g. a
  serverless-friendly Postgres provider + a Redis provider reachable
  over both pooled/edge and direct TCP connections) and are the shared
  source of truth/broadcast bus between the two runtimes.

## K. 2D Rendering Architecture

`apps/web/app/(dashboard)/properties/[id]/floor-plan/` renders a
`FloorPlanCanvas` (SVG) that:

1. Reads structural geometry (`Room.polygon`, `Door`/`Window` wall
   offsets) from TanStack Query — cached, rarely refetched.
2. Reads operational state (`Device` status fields, `SecurityState`)
   from the shared Zustand realtime slice (see M), kept live by the SSE
   subscription.
3. Composes per-room/per-device presentational components (`RoomShape`,
   `DoorIcon`, `DeviceMarker`) keyed by stable domain IDs
   (`room.id`, `device.id`), using selector-based subscriptions so an
   event affecting one device doesn't re-render the whole canvas.
4. Emits selection intents (`onDeviceClick(deviceId)`) into the same
   shared selection store consumed by the 3D view and the device detail
   panel.

No component in this tree queries Prisma or fetches data directly — all
data enters via the two hooks above.

## L. 3D Rendering Architecture

`apps/web/app/(dashboard)/properties/[id]/twin-3d/` (lazy-loaded route
chunk — the R3F/Three.js bundle never ships to users who don't open the
3D tab) renders `Scene3D`, built on React Three Fiber + Drei.

```
Digital Twin
     ↓
Geometry Adapter   (packages/three-adapter/src/adapt.ts)
     ↓
3D Scene Graph
```

The **geometry adapter** is a pure function,
`buildSceneGraph(property: StructuralModel): SceneGraph`, where
`SceneGraph` is `{ floors, rooms, openings, deviceAnchors }`. Every node
carries the originating domain ID (`room.id`, `door.id`, `device.id`) as
`userData.domainId`. This is the **only** place 2D polygons and wall
offsets become extruded 3D geometry — R3F components never read
`Room.polygon` directly, only the adapter's output.

Update flow:

- **Structural changes** (rare) rebuild the `SceneGraph` and diff
  against the current Three.js scene by `domainId` — add/remove meshes
  only for changed rooms.
- **Operational changes** (frequent) are handled by a separate, cheap
  path: `DeviceAnchor` components subscribe to the same Zustand selector
  as their 2D counterpart, keyed by `domainId`, and imperatively update
  only their own material/animation (door rotation, lock LED color) via
  refs/`useFrame` — never triggering a scene rebuild or React
  reconciliation of sibling meshes.

Fallback: `Scene3D` is wrapped in a WebGL-capability check and an R3F
error boundary. On failure it renders the 2D `FloorPlanCanvas` in its
place with a small inline notice — 3D is an enhanced interface, never
the only usable representation of property state.

## M. 2D / 3D Synchronization Strategy

Shared state layer (`packages/state`, added alongside the 2D/3D work):

- **TanStack Query** cache: structural model reads (`useProperty`,
  `useDevices`) — the slow-changing half. Both 2D and 3D read the
  identical query key/cache entry, so there is only ever one in-memory
  copy of structural data.
- **Zustand store** (`useRealtimeStore`): the fast-changing half — a
  normalized `Record<deviceId, DeviceOperationalState>` plus
  `securityState`, populated by a single SSE `EventSource` subscription
  per property. The client-side reducer applying incoming events is the
  **same function** imported from `packages/domain` that the server
  uses — client and server projections can never drift apart in logic.
- **Selection sync:** a `selectedDomainId: string | null` slice in the
  same store, set by either the 2D canvas's click handler or the 3D
  scene's raycast handler. Both sides subscribe to
  `selectedDomainId === thisId` — because both key off the same stable
  domain ID (never a view-local index), clicking a device in 3D
  highlights it in 2D and vice versa with no translation layer.

Cross-cutting invariant, enforced by tests once this layer exists: for a
scripted sequence of events, `domainStateProjection(events)` ==
2D-rendered state (from component props/DOM) == 3D-rendered state (from
scene `userData`).

## N. Device Provider Abstraction

```ts
interface SmartHomeProvider {
  readonly providerId: string; // "SIMULATION" | "HOME_ASSISTANT" | ...
  connect(propertyId: string): Promise<void>;
  disconnect(propertyId: string): Promise<void>;
  onEvent(handler: (event: DomainEventInput) => Promise<void>): void;
  sendCommand(command: DeviceCommand): Promise<CommandResult>;
}
```

```
Real Devices (future) ──┐
                        │
Home Assistant ─────────┤──► Normalised Device Events ──► Event Ingestion
                        │
Simulation Provider ────┘
```

`SimulationProvider` implements this exactly like a future
`HomeAssistantProvider`/`MatterProvider` would — calling the same
`handler` the realtime service registers for every provider, so
simulation cannot bypass validation, idempotency, or the reducer. This
is the documented integration boundary (see `DECISIONS.md` ADR-014):
HomeGuard's domain model never speaks HA/Matter vocabulary internally,
only at the edge of a provider adapter.

## O. Simulation Architecture

Simulation is registered as a `SmartHomeProvider`, never a UI-only fake
path. The **simulation clock** is a logical clock owned by the realtime
service per `SimulationRun`: `simClockMs` advances via a scaled-interval
tick, independent of wall-clock time, and is pausable/resettable/
seekable without affecting real-provider event timing running
concurrently for the same property.

Scenario definition shape (`SimulationScenario.script`, Zod-validated):

```ts
{ seed: number, steps: Array<{ atSimTimeMs: number, eventTemplate: DomainEventInput }> }
```

Deterministic because `seed` drives any randomized branching (e.g. which
window the "intrusion" scenario breaches) via a seeded PRNG — same seed
always produces the same event sequence, required for both demo
repeatability and Playwright fixtures. Controls (start/pause/reset/
speed) are plain authenticated HTTP commands from `apps/web` to the
realtime service's simulation-control endpoint. Every emitted event is
tagged `source: SIMULATION` at the schema level (non-optional, never
inferred), and the UI's event/alert renderers check this field to show
a persistent "SIMULATED" badge.

Planned scenarios: Normal Evening, Leaving Home, Night Mode, Intrusion,
Device Failure, and optionally a Leak/Smoke demo.

## P. Alert / Automation Architecture

**Alerts:** the ingestion reducer, after applying an operational-state
patch, calls a pure `evaluateAlertRules(event, newState)` (e.g.
`machineState -> ALARM` always raises `CRITICAL`). This runs
synchronously in the same transaction as the state write — an `Alert`
is itself security-relevant history with the same durability
requirement as section H. Alert lifecycle transitions
(`ACKNOWLEDGED`/`RESOLVED`) are user commands that themselves emit an
`Event` for auditability.

**Automations:**

```
Trigger
  +
Conditions
  ↓
Action
```

`AutomationRule.definition` is Zod-parsed into `{ trigger, conditions[],
actions[] }` — conditions are pure predicates over current operational
state (no eval, no arbitrary user code), actions are a closed enum
(`SEND_NOTIFICATION`, `SET_DEVICE_STATE`, `RAISE_ALERT`). Trigger and
condition **evaluation** happens synchronously in the same reducer pass
(for the same current-state-consistency reason as alerts); only action
**execution** is queued via BullMQ, since actions have side effects that
shouldn't block ingestion. This keeps automations deterministic and
testable: given `(event, state-before)`, `evaluateAutomationRules`
returns a fixed list of jobs to enqueue — a pure function, unit-testable
without Redis/BullMQ in the loop.

## Q. Historical Replay Strategy

_(Design now; built in a later phase — see section V.)_

```
Historical Events
       ↓
Replay Engine
       ↓
Digital Twin Snapshot
       ↓
2D / 3D
```

A BullMQ scheduled job takes a `Snapshot` of the full operational-state
projection on a fixed interval (proposal: every 15 minutes of
wall-clock time, plus immediately after every `security.mode` change,
since those are the most valuable replay anchor points).

Replay-to-time-`T` finds the latest `Snapshot` with `takenAt <= T`, then
folds forward every `Event` with `occurredAt` in `(snapshot.takenAt, T]`
through the **same** pure reducer used at ingestion (section H) —
guaranteeing replay produces bit-identical state to what was live at the
time. The replay UI reuses the K/L/M components unchanged, fed by a
one-shot `useReplayStore` instead of live SSE.

## R. Authentication / Authorization

Better Auth, self-hosted, Postgres-backed via its own Prisma adapter
tables (`Session`, `Account`, `Verification` alongside `User`), mounted
at `apps/web/app/api/auth/[...all]/route.ts`. Email+password for MVP;
a single OAuth provider can be added later without changing this shape.

Every property-scoped server action starts with:

```ts
const { userId, role } = await requirePropertyAccess(
  callerId,
  propertyId,
  minRole,
);
```

— one shared helper (`packages/auth`) backed by `Membership`, never an
inline `session.user.id === ...` check. Sensitive commands (unlock,
disarm) additionally require `role >= MEMBER` and are logged as
`source: USER` events carrying the acting `userId`, so every
security-sensitive action is independently auditable in the event
ledger, not just gated at the UI. The realtime service's internal
ingestion endpoint trusts only a service-to-service secret — end-user
authorization is fully resolved by `apps/web` before it ever calls the
realtime service.

Roles: `OWNER`, `ADMIN`, `MEMBER`, `VIEWER` (ascending trust:
`VIEWER < MEMBER < ADMIN < OWNER`).

## S. Security / Privacy Strategy

- Occupancy/presence exposed only as `UNKNOWN`/`VACANT`/`OCCUPIED` +
  confidence — no biometric fields anywhere in the schema.
- Cameras never store a real stream URL in this MVP; `cameraState` is a
  status enum, and the UI renders a "simulated feed" placeholder.
- PostHog receives only an allowlisted set of high-level product events
  (`viewed_dashboard`, `started_simulation`, `armed_security` — mode
  only, never which sensors) via a thin wrapper — raw domain events
  never flow to PostHog directly.
- Sentry's `beforeSend` strips `metadata` payloads and any room/
  device-correlatable movement data; only error stack + safe
  route/property-count-level context is retained.
- Every Prisma query in a server action is property-scoped through
  `requirePropertyAccess` — no endpoint returns cross-property data.
- No property route is ever public/unauthenticated — the marketing/
  landing page is fully separate from any `/properties/:id/*` route
  tree.

## T. Testing Strategy

See [`TESTING.md`](./TESTING.md) for the full breakdown. Summary: Vitest
for pure domain logic (state machine, reducers, evaluators, geometry
adapter, Zod schemas) and the 2D/3D state-sync invariant; React Testing
Library for components; Playwright for end-to-end journeys against a
deterministic seeded fixture property; a mock-SSE harness for realtime
resilience (reconnect, dedup, missed-event recovery).

## U. Deployment Architecture

```
┌─────────────────────┐        ┌──────────────────────────┐
│  Vercel (apps/web)   │        │ Fly.io (realtime-service) │
│                      │        │                          │
│  UI, server actions, │──HTTP─▶│  SSE stream               │
│  command APIs,       │  (svc  │  Ingestion endpoint       │
│  initial state fetch │  auth) │  BullMQ workers           │
│                      │        │  Simulation clock         │
└──────────┬───────────┘        └─────────────┬────────────┘
           │                                   │
           └───────────────┬───────────────────┘
                            ▼
              ┌──────────────────────────┐
              │  Shared Postgres + Redis  │
              └──────────────────────────┘
```

**Vercel (`apps/web`)** env: `DATABASE_URL` (pooled), `BETTER_AUTH_SECRET`,
`BETTER_AUTH_URL`, `REDIS_URL`, `FLY_INGESTION_URL` + `FLY_SERVICE_SECRET`,
`NEXT_PUBLIC_REALTIME_SSE_URL`, `SENTRY_DSN`, `POSTHOG_KEY`.

**Fly.io (`apps/realtime-service`)** env: `DATABASE_URL` (direct),
`REDIS_URL` (full TCP), `FLY_SERVICE_SECRET`, `SENTRY_DSN`.

Both runtimes import the same generated Prisma client from
`packages/database` — there is exactly one schema, never two drifting
copies. CI (GitHub Actions) runs `lint → typecheck → test → build`
before any deploy step; deploy steps are stubbed/documented in
`.github/workflows/ci.yml` rather than wired to live credentials in this
pass — Vercel deploys `apps/web` via its own Git integration, and a
future job would `flyctl deploy` the realtime service once secrets are
provisioned.

## V. Vertical-Slice Roadmap

**Phase 1 (this pass):** pnpm workspace scaffold, Next.js 16 app,
Prisma schema (all models above, migratable), Better Auth wiring,
Biome/Husky/lint-staged, GitHub Actions CI, and this documentation set.
No domain UI, rendering, realtime, or simulation code yet.

**Phase 2 — Structural CRUD & onboarding.** Property/Floor/Room/Door/
Window server actions and a minimal, non-CAD room editor. First file:
`apps/web/app/(dashboard)/properties/new/actions.ts`.

**Phase 3 — Realtime service skeleton + ingestion.** Stand up the
Fly.io process; wire the synchronous reducer + SSE endpoint against a
manually-POSTed test event. First file:
`apps/realtime-service/src/ingestion/handler.ts`.

**Phase 4 — Device model + dashboard list.** Device CRUD/capabilities;
a plain table dashboard showing live state via Phase 3's SSE. First
file: `packages/domain/src/devices/reducer.ts`.

**Phase 5 — Security state machine + zones.** Sections E/F implemented
for real; arm/disarm server actions; mode control UI. First file:
`packages/domain/src/security/stateMachine.ts`.

**Phase 6 — 2D floor plan.** SVG canvas per section K. First file:
`apps/web/app/(dashboard)/properties/[id]/floor-plan/FloorPlanCanvas.tsx`.

**Phase 7 — 3D twin.** React Three Fiber + geometry adapter per section
L (first point Three.js becomes a dependency). First file:
`packages/three-adapter/src/adapt.ts`.

**Phase 8 — 2D/3D sync layer.** Zustand store per section M; retrofit
Phases 6/7 to share it. First file: `packages/state/src/realtimeStore.ts`.

**Phase 9 — Simulation engine.** `SimulationProvider` + clock + the
"Normal Evening" scenario. First file:
`packages/domain/src/providers/SimulationProvider.ts`.

**Phase 10 — More scenarios + controls UI.** Leaving Home, Night Mode,
Intrusion, Device Failure. First file:
`packages/fixtures/src/scenarios/intrusion.ts`.

**Phase 11 — Alerts & automation.** Lifecycle UI + structured rule
builder per section P. First file:
`packages/domain/src/alerts/evaluate.ts`.

**Phase 12 — Occupancy/presence.** Redis-backed estimate + confidence
model. First file: `packages/domain/src/occupancy/estimate.ts`.

**Phase 13 — Snapshotting + replay.** Snapshot job + replay UI per
section Q. First file: `apps/realtime-service/src/jobs/snapshot.ts`.

**Phase 14 — Playwright E2E + realtime resilience.** Monitoring/
simulation/intrusion journeys; reconnect/dedup tests. First file:
`apps/web/e2e/monitoring.spec.ts`.

**Phase 15 — Future-provider hardening.** `HomeAssistantProvider` stub
against the Phase-9 interface, without shipping real HA connectivity.
First file: `packages/domain/src/providers/HomeAssistantProvider.stub.ts`.

## W. Primary Risks and Mitigations

1. **Split-brain state writes** (Vercel and Fly.io both mutating
   operational state independently) — only the realtime service's
   ingestion endpoint ever runs the reducer; Vercel always calls into
   it (section J).
2. **SSE connection scaling** on a single Fly.io machine — acceptable
   at scale; documented as a known boundary rather than
   solved prematurely (horizontal scaling via machine count + Redis
   pub/sub fan-out if ever needed).
3. **`Event.type` string drift** — the Zod discriminated union in
   `packages/domain` is the real closed vocabulary; a test asserts
   every `type` literal used in code has a matching schema.
4. **3D bundle size / WebGL failures** degrading the flagship feature —
   lazy route-level code splitting plus mandatory WebGL-capability
   fallback to 2D-only.
5. **Simulated events read as real** — `source` is a non-optional
   schema field; any Alert/Event-rendering component must branch on
   `source === SIMULATION` for badge display, covered by a Playwright
   assertion once the simulation UI exists.
6. **Schema over-scoping** — the "not modeled yet" list in section A,
   with one-line rationale for each omission, keeps the schema lean.
7. **Better Auth/Prisma adapter version drift** — pin the adapter
   version; test `requirePropertyAccess` independently of Better Auth
   internals.
8. **Redis scope creep into source-of-truth territory** as features are
   added in later phases — the section I hard rule is a code-review
   checklist item, not just documentation.
