# AI_ENGINEERING.md

HomeGuard 3D is built with Claude Code as an AI engineering collaborator.
This document is a transparent record of what that means in practice:
what Claude Code was asked to do, what a human reviewed and decided, and
how that division of labor is expected to continue across the project's
remaining phases.

**This is presented as professional AI-assisted systems engineering, not
an autonomously generated security system.** Every architectural
decision recorded in `DECISIONS.md` was proposed by Claude Code and
approved by a human before implementation began; no security-relevant
behavior in this codebase ships without that review step.

## How Phase 1 was built

1. **Planning brief.** The project began from a detailed product/
   architecture brief (product vision, domain requirements, target
   stack, phased roadmap, explicit non-goals) supplied by the human
   engineer.
2. **Architecture proposal.** Claude Code was asked to research the
   brief and produce a complete architecture proposal covering the
   domain model, Prisma schema, security state machine, event pipeline,
   realtime transport decision, 2D/3D rendering and synchronization
   strategy, device provider abstraction, simulation architecture,
   deployment topology, testing strategy, and a phased implementation
   plan — around 20 discrete design decisions in total.
3. **Human review and scope decisions.** Before any code was written,
   the human engineer made three explicit scope calls that Claude Code
   could not have inferred on its own:
   - This pass delivers a full architecture document plus a minimal
     scaffold only — no domain UI, rendering, realtime, or simulation
     code yet.
   - Better Auth (self-hosted) over Clerk for authentication.
   - Vercel + a separate Fly.io service (rather than a single
     deployment target) for the realtime/worker runtime.
4. **Implementation.** With scope and key decisions fixed, Claude Code
   implemented the pnpm workspace, the full Prisma schema, the Better
   Auth wiring, the Biome/Husky/lint-staged tooling, the GitHub Actions
   CI workflow, and this documentation set — then verified the result
   end-to-end (schema validation, a real migration against a local
   Postgres, lint, typecheck, and build all passing) rather than
   reporting success without running anything.

## Human responsibilities

- **Product direction** — what HomeGuard is and is not (see the
  Explicit MVP Non-Goals in the original brief and the Privacy/Security
  Limitations in `README.md`).
- **Architecture approval** — every ADR in `DECISIONS.md` was proposed
  by Claude Code and required explicit human sign-off before
  implementation, including the three scope decisions above.
- **Security semantics** — what counts as a security-relevant fact
  (and therefore must live in Postgres, not Redis), what the arm/
  disarm state machine is allowed to do, and what "always allow
  disarming your own alarm" means in practice (ADR-009).
- **Privacy decisions** — the explicit refusal to model biometric
  identity, real camera feeds, or always-listening audio (ADR-013).
- **UX** — the shape of the monitoring/simulation/replay experiences
  described in the brief.
- **Simulation design** — which scenarios matter for a credible demo
  (Normal Evening, Leaving Home, Intrusion, Device Failure) and what
  "SIMULATED" labeling needs to look like.
- **Code review** — every file Claude Code wrote in this pass was
  reviewable in the same session it was written, with build/lint/
  typecheck/migration output shown as verification, not asserted.
- **Security review and deployment decisions** — for future phases:
  provisioning real credentials, choosing a production Postgres/Redis
  provider, and enabling live deploys are explicitly human-gated steps,
  not something an agent should do autonomously.

## AI-assisted responsibilities

- **Implementation** — the Prisma schema, workspace/tooling
  configuration, Better Auth wiring, and CI workflow in this pass; the
  domain logic, rendering, realtime pipeline, and simulation engine in
  future phases.
- **Schema and migrations** — proposing and generating Prisma models
  and migrations, always reviewed against the structural/operational/
  historical separation before being applied.
- **Event adapters and the provider abstraction** — implementing
  `SmartHomeProvider` conformance for simulation and, later, real
  integrations, always as a plain translation layer at the edge (ADR-014).
- **3D plumbing** — the geometry adapter and scene-graph wiring, kept
  isolated from domain logic per the architecture's boundary rules.
- **Simulation** — scenario scripting and the seeded-clock
  implementation, once scenario *content* is human-approved.
- **Refactoring** — restructuring code without changing behavior,
  always paired with the existing test suite passing before and after.
- **Documentation** — this file and the other five repo docs are
  themselves an AI-assisted deliverable, kept in sync with the actual
  code rather than written once and left to rot.
- **Debugging** — for example, in this pass: diagnosing and fixing a
  Turbopack module-resolution failure caused by `.js`-suffixed relative
  imports against raw TypeScript source packages, and reordering the
  `apps/web` typecheck script to run `next typegen` before `tsc
  --noEmit` so Next's route-level ambient types exist before type
  checking runs.
- **Performance suggestions** — e.g., the "operational changes update
  only the relevant mesh imperatively, never rebuild the scene" rule in
  `ARCHITECTURE.md` section L, proposed as a scene-architecture decision
  during planning and enforced going forward via `AGENTS.md`.

## What changes going forward

As HomeGuard moves into Phase 2 and beyond, the same pattern continues:
Claude Code proposes an implementation plan for the next vertical slice
against the architecture already agreed here, a human reviews it before
non-trivial code is written, and every change to security-relevant logic
(the state machine, authorization checks, event validation) ships with
tests in the same change — per the load-bearing rules in `AGENTS.md`.
