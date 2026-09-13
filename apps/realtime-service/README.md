# @homeguard/realtime-service

Persistent Node process deployed to Fly.io. Owns the realtime transport
(SSE), the event ingestion endpoint, BullMQ workers, and the simulation
clock — see `ARCHITECTURE.md` section U (Deployment Architecture) and
section J (Realtime Transport Decision) at the repo root.

**Status: scaffold only (Phase 1).** `src/index.ts` is a placeholder.
Phase 3 (see the roadmap in the repo's plan history / `ARCHITECTURE.md`
section V) wires up the real ingestion handler at
`src/ingestion/handler.ts`.
