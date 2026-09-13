export type SimulationClockStatus = "RUNNING" | "PAUSED" | "COMPLETED";

export interface SimulationClockState {
  simClockMs: number;
  speedFactor: number;
  status: SimulationClockStatus;
}

export function advanceSimulationClock(
  state: SimulationClockState,
  elapsedWallMs: number,
  endAtSimTimeMs: number,
): SimulationClockState {
  if (state.status !== "RUNNING" || elapsedWallMs <= 0) return state;
  const simClockMs = Math.min(endAtSimTimeMs, state.simClockMs + elapsedWallMs * state.speedFactor);
  return {
    ...state,
    simClockMs,
    status: simClockMs >= endAtSimTimeMs ? "COMPLETED" : "RUNNING",
  };
}

export function dueStepIndexes(
  stepTimes: number[],
  previousSimClockMs: number,
  currentSimClockMs: number,
): number[] {
  return stepTimes.flatMap((time, index) =>
    time > previousSimClockMs && time <= currentSimClockMs ? [index] : [],
  );
}
