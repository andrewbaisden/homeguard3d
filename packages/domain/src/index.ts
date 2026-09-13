/**
 * @homeguard/domain — pure domain logic: event schemas, the device
 * current-state reducer, the security state machine, provider
 * abstraction, and alert/automation evaluation.
 *
 * Rule (see AGENTS.md): everything in this package must be pure —
 * no Prisma import, no fetch, no I/O. Callers (the realtime service,
 * server actions) own persistence and side effects.
 */
export * from "./events/schema";
export * from "./devices/reducer";
export * from "./geometry/plan";
export * from "./twin/model";
export * from "./security/stateMachine";
export * from "./security/mapEvent";
export * from "./providers/SmartHomeProvider";
export * from "./providers/SimulationProvider";
export * from "./simulation/clock";
export * from "./simulation/scenario";
export * from "./alerts/evaluate";
export * from "./automation/schema";
export * from "./automation/evaluate";
export * from "./occupancy/estimate";
