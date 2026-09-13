# DECISIONS.md — Architecture Decision Records

Each ADR records a choice, the alternatives considered, and why the
chosen option won. See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for how
these decisions fit together as a system.

---

## ADR-001: 2D and 3D derive from one digital-twin model

**Decision:** The 2D floor plan and 3D scene are both pure render
targets of the same structural (TanStack Query) and operational
(Zustand) state. Neither owns state independently.

**Alternatives considered:** Separate state per view (each view fetches
and manages its own copy); a single "view model" object recomputed for
each renderer.

**Why:** The product's core value proposition is that opening the home
in 2D or 3D shows *the same reality*. Two independently-managed copies
of room/device state inevitably drift (a door marked open in 2D but not
yet in 3D during a fast event burst) and every synchronization bug
directly undermines user trust in the platform. A single source read by
both is structurally incapable of drifting, since there's only one
number to be wrong.

## ADR-002: Structural, operational, and event state are separate

**Decision:** Three distinct buckets — structural (Property/Floor/Room/
Door/Window/device placement), operational (current Device/SecurityState
status), and event history (append-only `Event` log) — modeled as
distinct Prisma concerns with different mutation patterns.

**Alternatives considered:** One unified "current state" document per
property (loses history); event-sourced-only (see ADR-003).

**Why:** These three have fundamentally different change frequency,
mutation authority, and consumers. Structural data changes rarely and
is edited by users; operational data changes constantly and is written
only by the event reducer; historical data is append-only and never
edited. Conflating them (e.g., storing "door open" as if it were
structural, or trying to derive structural geometry from events) breaks
the mental model for every future contributor and every query pattern.

## ADR-003: Event history without full event sourcing

**Decision:** Keep an append-only `Event` table as the historical
record and audit trail, but maintain operational state as
continuously-updated Postgres columns (a projection written once at
ingestion), not recomputed from the full event log on every read.

**Alternatives considered:** Full event sourcing (operational state is
always derived by replaying all events for an aggregate on read, with
or without caching).

**Why:** Full event sourcing would make every dashboard/2D/3D query
`O(history)` unless paired with its own snapshot/cache layer — which is
just this design with extra indirection. HomeGuard's operational
queries (is the door open, is the alarm armed) need to be simple,
cheap, single-row reads, because they happen on every realtime tick
across every open client. The event log still exists in full for audit
and replay (see ADR-015) — this is "event-sourcing-adjacent," not
"no event history."

## ADR-004: PostgreSQL vs Redis boundary

**Decision:** Postgres holds every durable fact (structural model,
operational state, event history, alerts, automation rules, simulation
definitions/runs, snapshots). Redis holds only ephemeral/realtime
concerns (pub/sub fan-out, live presence estimates, BullMQ state,
connection registries, simulation clock runtime ticks).

**Alternatives considered:** Redis as the primary store for "hot" device
state, with Postgres as a slower audit copy.

**Why:** A security platform cannot tolerate losing a security-relevant
fact to a Redis restart or eviction. The rule is simple and
enforceable: if losing it would silently lose a security fact, it's in
Postgres; if losing it just means "wait for the next update," Redis is
fine and often better (TTL decay, pub/sub, high write throughput).

## ADR-005: WebSockets vs Server-Sent Events

**Decision:** SSE for server→client realtime updates; plain
authenticated HTTP (server actions / REST) for client→server commands.
No WebSocket.

**Alternatives considered:** WebSocket for full-duplex realtime;
long-polling.

**Why:** The realtime need is overwhelmingly one-directional — push
state, passively re-render. The handful of client→server interactions
(arm/disarm, simulation controls, lock/unlock) are discrete commands
with a request/response shape, not a stream; they get full
validation/authorization/idempotency by going through ordinary HTTP into
the same event pipeline as anything else. SSE also gets automatic
reconnection from the browser's `EventSource` for free and needs no
special reverse-proxy configuration, which matters when the stream is
served from a separate Fly.io origin from the Vercel-hosted UI. A
WebSocket would add real-duplex complexity (connection lifecycle,
heartbeats, message framing) to solve a problem HomeGuard doesn't have.

## ADR-006: Simulation behaves as a smart-home provider

**Decision:** `SimulationProvider` implements the same
`SmartHomeProvider` interface a future real integration would, and
calls the same ingestion handler — there is no separate "fake UI" code
path for demo data.

**Alternatives considered:** A simulation-specific mock API that
directly sets component state or a separate demo-mode data layer.

**Why:** If simulation had its own path, every bug fix and every new
feature in the real pipeline (validation, idempotency, the reducer,
alerting) would need a parallel implementation in the fake path, and the
two would drift — defeating simulation's purpose as a credible stand-in
for real hardware. Routing simulation through the identical pipeline
also means the flagship demo experience *is* an integration test of the
production path, running on every scenario playthrough.

## ADR-007: React Three Fiber + a pure geometry adapter

**Decision:** 3D rendering uses React Three Fiber + Drei. A pure
function (`buildSceneGraph`) is the only bridge from structural domain
data to Three.js geometry; no R3F component reads Prisma-shaped data
directly.

**Alternatives considered:** Raw Three.js imperative code; a
game-engine-style external renderer (Babylon.js, a WebGL wrapper of a
different shape).

**Why:** R3F lets 3D scene structure be expressed declaratively as
React components, which keeps it compositionally consistent with the
rest of the Next.js app (same component/hook idioms, same testing
tools for the adapter layer) while Drei's helpers (`OrbitControls`,
camera utilities) cover the interaction requirements (orbit, dollhouse,
floor isolation) without hand-rolling them. The geometry adapter
boundary exists so 3D-specific concerns (extrusion, materials, meshes)
never leak into domain code, and domain concerns (room polygons, wall
offsets) never leak into rendering code — each side can change
independently and each side is testable on its own terms (adapter
output shape via Vitest; visual behavior manually, per `TESTING.md`).

## ADR-008: Device capability model — typed columns over subtype tables

**Decision:** `Device` carries typed nullable columns per state axis
(`doorState`, `lockState`, `motionState`, `cameraState`, `batteryPct`,
`tempC`, `humidityPct`), gated by a `DeviceCapability` join describing
what each device instance supports.

**Alternatives considered:** Per-category subtype tables (`LockDevice`,
`CameraDevice`, ...) with a shared supertype; a generic key/value state
table.

**Why:** Prisma/Postgres has no first-class polymorphic inheritance.
Subtype tables would force a join on every mixed-category device read —
which happens on every realtime tick across 2D, 3D, the dashboard, and
automation evaluation. A key/value table loses type safety and the
explicit-enum requirement (door state must be `OPEN`/`CLOSED`/
`UNKNOWN`, not an untyped value). Typed columns keep every device read a
single-row, no-join operation, at the cost of some unused nullable
columns per device — an acceptable trade for a schema of this size.

## ADR-009: Security state-machine design

**Decision:** A fixed, explicit state machine (`IDLE_DISARMED →
EXIT_DELAY → ARMED → ENTRY_DELAY/ALERT → ALARM`, with `DISARMING`
reachable from any armed state) implemented as one pure function,
`transition(current, event, zoneSnapshot)`.

**Alternatives considered:** Boolean flags scattered across
`SecurityState` (`isArmed`, `isAlarming`, `isPending`, ...); arming logic
embedded in UI event handlers or server actions directly.

**Why:** Security arming/disarming has real invalid-transition risk
(disarming during `EXIT_DELAY` vs `ALARM` mean different things; a
sensor trigger during `HOME` mode vs `AWAY` mode should have different
effects). A named state machine makes every legal transition explicit
and every illegal one a compile-time-checkable/test-checkable rejection,
and concentrates a security-critical decision in one auditable,
100%-unit-tested location rather than several call sites that could
each drift.

## ADR-010: Occupancy confidence model

**Decision:** Occupancy is represented as `UNKNOWN`/`VACANT`/`OCCUPIED`
with an associated confidence score and supporting evidence (e.g.,
"motion sensor 8s ago", "door entry 34s ago"), never as an identified
individual.

**Alternatives considered:** Binary occupied/vacant without confidence;
named/identified occupants inferred from device patterns.

**Why:** Occupancy is *inferred*, not observed directly — a motion
sensor firing is evidence, not proof, and pretending otherwise
(reporting false certainty, or worse, claiming to know *who* is present
without any identity source) would be both misleading and a privacy
overreach the product explicitly rejects. A confidence + evidence model
is honest about what the system actually knows.

## ADR-011: Automation rule architecture

**Decision:** Automation rules are structured `{ trigger, conditions[],
actions[] }` data, Zod-validated, with a closed action enum. No
arbitrary user code, no `eval`.

**Alternatives considered:** A scripting language or JS sandbox for
user-authored automation logic.

**Why:** Arbitrary code execution in a home-security context is a
direct security liability (privilege escalation, unbounded resource
use, unauditable behavior) for a feature that doesn't need that power —
the brief's own rule set (trigger + conditions → action) covers the
realistic smart-home automation space. Structured rules are also
trivially testable as pure functions and safely displayable in a UI
rule builder without an interpreter.

## ADR-012: Event retention strategy

**Decision:** All events are retained in Postgres by default for this
MVP; retention tiers (long retention for security events, shorter for
routine motion, longer for aggregated occupancy rollups) are designed
into the schema (`Event.type`, `source`, indexes) but not yet enforced
by an automated deletion job.

**Alternatives considered:** Aggressive default deletion of routine
events; a fully-designed retention job shipped in Phase 1.

**Why:** Retention policy needs real usage data (event volume per
property, which event types actually accumulate fastest) to tune
correctly, and building a deletion job before there's meaningful data to
validate it against risks deleting something a later feature (analytics,
replay) needs. The schema is deliberately retention-policy-ready
(indexed by `propertyId`+`occurredAt` and `propertyId`+`type`, so a
future tiered-deletion job is a straightforward addition) without
committing to specific tier durations prematurely.

## ADR-013: Privacy strategy

**Decision:** No biometric/facial-recognition fields anywhere in the
schema; camera devices are status-only (no real stream URLs or video
storage) in this MVP; analytics (PostHog) receive only an explicit
allowlist of high-level product events; error reporting (Sentry) strips
event metadata and movement-correlatable data.

**Alternatives considered:** Capturing richer behavioral data "for
future analytics features" and restricting access later via
application-layer filtering.

**Why:** Data minimization has to happen at the point of collection —
restricting access later doesn't undo the exposure risk of having
collected sensitive behavioral/location data in the first place, and it
doesn't undo the trust cost of a smart-home platform that could
technically answer "where has this person been in their own home."
Building the boundary in from the start (no biometric columns to begin
with) is simpler and safer than auditing for misuse later.

## ADR-014: Future Home Assistant / Matter integration boundary

**Decision:** The `SmartHomeProvider` interface is the only integration
point for any external device ecosystem. HomeGuard's domain model never
speaks Home Assistant's or Matter's native vocabulary internally —
translation happens entirely inside a provider adapter, at the edge.

**Alternatives considered:** Modeling HomeGuard's domain directly around
Home Assistant's entity/state conventions, since it's a likely first
real integration.

**Why:** Coupling the core domain model to one external ecosystem's
conventions would make a second integration (Matter, or a different
platform) a retrofit rather than "implement one more adapter." Keeping
the domain model provider-neutral (as it already needs to be to support
simulation credibly, per ADR-006) means every future integration is the
same shape of work: implement `SmartHomeProvider`, translate at the
edge, never touch the reducer/state machine/event schema.

## ADR-015: Historical replay / snapshot strategy

**Decision:** Periodic `Snapshot` rows (proposed: every 15 minutes, plus
immediately after every security-mode change) capture the full
operational-state projection. Replay-to-time-`T` loads the latest
snapshot `<= T` and folds forward every event since through the same
reducer used at ingestion.

**Alternatives considered:** No snapshots — replay always folds from
the beginning of the property's event history; continuous
(per-event) snapshotting.

**Why:** Folding from the beginning of history gets more expensive
without bound as a property accumulates months of events, which
directly undermines "replay should feel instant" as a flagship feature.
Per-event snapshotting is unnecessary write amplification — periodic
snapshots plus a bounded fold window is the standard trade-off, and
anchoring snapshots to security-mode changes specifically means the
most replay-worthy moments (an arm/disarm cycle, an alarm sequence) are
always close to a snapshot boundary. Using the exact same reducer for
replay as for live ingestion guarantees the replayed state is
bit-identical to what was actually shown live — there's no separate
"replay logic" to drift from "live logic."
