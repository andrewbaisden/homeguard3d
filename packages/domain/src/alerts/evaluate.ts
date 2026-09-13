// Alert + automation rule evaluation — Phase 11.
//
// evaluateAlertRules(event, newState) -> Alert[] and
// evaluateAutomationRules(event, stateBefore) -> Action[] are both
// pure functions over already-computed state, run synchronously in
// the same reducer pass as the operational-state write (see
// ARCHITECTURE.md section P). Only Action *execution* is queued via
// BullMQ — evaluation itself must stay pure and unit-testable without
// Redis/BullMQ in the loop.
export {};
