/**
 * HomeGuard realtime service — placeholder entry point.
 *
 * This process (deployed to Fly.io, see ARCHITECTURE.md section U)
 * will host:
 *   - the SSE realtime stream (GET /realtime/:propertyId/stream)
 *   - the internal event ingestion endpoint (Zod validate -> reducer ->
 *     commit -> Redis publish), authenticated by FLY_SERVICE_SECRET
 *   - BullMQ workers (automation actions, connectivity sweep,
 *     snapshotting)
 *   - the simulation clock/scheduler
 *
 * None of that is wired up yet — this is a Phase 1 scaffold placeholder
 * so the workspace has a buildable second runtime. See PLAN Phase 3 for
 * the first real ingestion implementation.
 */
function main(): void {
  console.log("[homeguard-realtime-service] scaffold placeholder — no server started yet");
}

main();
