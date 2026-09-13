# TESTING.md

HomeGuard's testing burden is unusual for a CRUD app: the same fact
(door state, security mode) is represented in at least three places at
once (domain projection, 2D view, 3D view), and a security state
machine has real invalid-transition risk. This document describes what
is tested, at what layer, and why — and how 3D functionality is tested
*without* attempting to test Three.js itself.

**Status:** this describes the target testing strategy. As of Phase 1
(scaffold), no domain logic exists yet to test; `packages/domain`'s
`test` script is a placeholder that will be replaced with real Vitest
suites starting Phase 4 (device reducer) and Phase 5 (security state
machine).

## Test layers

| Layer | Tooling | What |
|---|---|---|
| Domain logic | Vitest | Security state machine, event reducers, alert/automation evaluators, occupancy confidence, geometry adapter, Zod schemas |
| State-sync invariant | Vitest / RTL integration | `domain projection == 2D rendered state == 3D scene userData state` |
| Components | React Testing Library | Dashboard cards, room/device panels, security controls, alert list, timeline, simulation controls, automation forms, loading/stale/offline states |
| Realtime | Vitest + a mock SSE harness | Subscribe, reconnect, duplicate delivery, missed-event recovery |
| End-to-end | Playwright | Monitoring journey, simulation journey, intrusion scenario journey |

## Domain / unit tests (Vitest)

### Security state machine

Table-driven: every `(currentState, eventType, zoneSnapshot)` triple in
the transition table (`ARCHITECTURE.md` section E) gets a test case
asserting the correct `next` state and `effects`, plus explicit
negative cases (an event that should *not* cause a transition from a
given state must return the same state unchanged, not throw or silently
mutate). Because the module is pure with no I/O, these tests need zero
mocking.

### Device events / reducer

- Applying a known event to a known device state produces the expected
  patch.
- **Idempotency:** applying the same `eventId` twice produces the same
  resulting state as applying it once (no double-counting, no duplicate
  side effects).
- **Ordering:** an event with an older `sequence` than the device's
  last-applied sequence is stored in history but does not reproject
  operational state; a newer one does.
- **Stale events:** an event referencing a device/property mismatch
  (see Event Invariants below) is rejected before the reducer runs.

### Automations

- Trigger matching: a rule's trigger only matches its declared event
  type(s).
- Condition evaluation: conditions are pure predicates over a given
  state snapshot — test both satisfied and unsatisfied cases.
- Action selection: given a matching trigger and satisfied conditions,
  the correct action list is returned.
- **Idempotency:** evaluating the same `(event, state)` pair twice
  returns the same action list — automations must not accumulate side
  effects from re-evaluation (e.g., after an out-of-order event replay).

### Occupancy

- Room entry/exit event sequences produce the expected confidence
  trajectory.
- Ambiguous state (conflicting or stale evidence) degrades to `UNKNOWN`
  rather than asserting a confident answer.
- Confidence decay over time in the absence of new evidence.

### Simulation

- **Seeded determinism:** running a scenario twice with the same seed
  produces an identical event sequence (asserted by snapshotting the
  full ordered event list, not just spot-checking a few events).
- Movement between rooms generates the expected ordered device events
  (e.g., front door → hallway motion → kitchen motion), never just an
  animation with no corresponding domain events.
- Pause/resume preserves scenario position; reset returns to a clean
  initial state.

### Geometry / domain adapter

- `buildSceneGraph` output shape and `userData.domainId` mapping given
  fixture structural models (a room polygon in, the expected mesh
  descriptor + domain ID out).
- Room/device coordinate and floor-relationship lookups against fixture
  data.

### Zod event schemas

- Valid payload fixtures for every event `type` parse successfully.
- Invalid/malformed payloads (wrong shape, wrong enum value, missing
  required field) are rejected with a clear validation error.

## State synchronization tests

Explicitly assert, at the integration boundary (once the 2D/3D/sync
layer exists — Phase 8+):

```
domain state == 2D displayed state == 3D displayed state
```

for a scripted sequence of events, replayed through the real reducer
and rendered by the real 2D and 3D view-model code — not by
hand-constructing "expected" component props separately from what the
reducer actually produces. This catches the class of bug where 2D and
3D each independently (and slightly differently) interpret the same
domain event.

**We do not unit test Three.js internals.** These tests assert against
the *adapter output* (`SceneGraph` shape, `userData.domainId` values)
and, where a full-scene assertion is useful, against R3F component
props/refs — never against WebGL draw calls, shader output, or pixel
content.

## Event invariants

Enforced by dedicated tests, not just incidentally covered:

- An `OPEN` door cannot simultaneously have `contactState: CLOSED` on
  its linked device after the reducer runs.
- A device event must belong to the same `propertyId` as its `deviceId`
  — cross-property event injection is rejected at ingestion, before the
  reducer runs.
- A simulated event must always carry `source: SIMULATION` — this is
  schema-level (Zod discriminated union requires it), and a test
  confirms the simulation provider never omits or overrides it.
- An unauthorized user cannot issue a door-unlock or disarm command —
  tested against `requirePropertyAccess` directly (unit) and via a
  command-endpoint integration test (a `VIEWER`-role request to a
  `MEMBER`+-gated endpoint is rejected).

## React Testing Library

Component-level tests cover: dashboard summary cards (secure/alert
states), room and device panels (including stale/offline device
presentation), security mode controls (arm/disarm, including
disabled/pending states during `EXIT_DELAY`), the alert list (severity
styling, lifecycle actions), the event timeline (filtering by device/
room/type/time range), simulation controls (start/pause/reset/speed),
and automation rule forms (validation, structured trigger/condition/
action inputs).

## Playwright (end-to-end)

**Monitoring journey:**

```
Sign In
 ↓
Open Home
 ↓
View Security State
 ↓
Open 2D View
 ↓
Open 3D View
 ↓
Select Room
 ↓
Inspect Device
 ↓
View Timeline
```

**Simulation journey:**

```
Open Simulation
 ↓
Choose Normal Evening
 ↓
Start
 ↓
Person Enters
 ↓
Door/Sensor Events Appear
 ↓
2D and 3D Update
 ↓
Pause
 ↓
Resume
 ↓
Reset
```

**Security/intrusion scenario:**

```
Arm Away
 ↓
Start Intrusion Simulation
 ↓
Window Event
 ↓
Motion Event
 ↓
Alert Triggered
 ↓
Inspect Event Sequence
```

Each journey runs against a deterministic seeded fixture property (see
below), so assertions can target specific rooms/devices/timings rather
than "some room changed state."

## Realtime tests

A mock SSE harness (server-side test double emitting `EventSource`-shaped
messages) covers:

- Initial subscribe receives current full state.
- Reconnect after a dropped connection re-syncs via the snapshot fetch
  rather than assuming no events were missed.
- Duplicate event delivery (simulating an at-least-once redelivery) does
  not double-apply state changes on the client.
- A client that misses events during a disconnect window recovers
  correct state after reconnect, not just "some" state.

These are not left to E2E tests alone — Playwright exercises the happy
path end-to-end, but connection-loss/reconnect edge cases are covered
directly against the SSE client logic.

## Fixtures

A small, deterministic fixture property (`packages/fixtures`) is shared
across Vitest, RTL, and Playwright:

```
Apartment Fixture
1 floor, 5 rooms, 6 doors, 5 windows, 8 devices, 2 cameras
```

Using one shared fixture (rather than ad hoc per-test data) means a
Playwright assertion like "kitchen motion sensor" refers to the exact
same domain object a Vitest reducer test exercises — reducing the
chance that a passing test suite still misses a real bug because the
test data didn't resemble anything realistic.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs, on every push and PR
to `main`: install → Prisma generate → lint (Biome) → typecheck → test
(Vitest) → build (both apps). State-machine and event-reducer tests are
part of the standard `pnpm test` run and therefore block merge on
failure like any other test — there is no separate "critical tests"
gate yet, since as of Phase 1 there are no domain tests to run.
Playwright is not yet wired into CI (added alongside Phase 14); running
it will require either a lightweight seeded test database in CI or a
recorded-fixture mode, to be decided when that phase starts.
