// Security state machine — Phase 5.
//
// Implements the transition table in DECISIONS.md / ARCHITECTURE.md
// section E: IDLE_DISARMED -> EXIT_DELAY -> ARMED -> ENTRY_DELAY/ALERT
// -> ALARM, with DISARMING always reachable from any armed state.
//
// Must stay a pure function: transition(current, event, zoneSnapshot)
// -> { next, effects }. No Prisma import, no I/O — see AGENTS.md.
// This is the single "never change without tests" boundary in the app.
export {};
