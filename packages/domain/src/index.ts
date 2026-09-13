/**
 * @homeguard/domain — pure domain logic: security state machine, event
 * schemas, provider abstraction, alert/automation evaluation.
 *
 * Deliberately empty in Phase 1 (scaffold-only pass). See
 * ARCHITECTURE.md sections E-P and DECISIONS.md for the design this
 * package will implement, and PLAN roadmap Phases 3-11 for build order.
 *
 * Rule (see AGENTS.md): everything in this package must be pure —
 * no Prisma import, no fetch, no I/O. Callers (the realtime service,
 * server actions) own persistence and side effects.
 */
export {};
