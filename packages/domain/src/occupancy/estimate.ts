import { z } from "zod";

export const occupancyStatusSchema = z.enum(["UNKNOWN", "VACANT", "OCCUPIED"]);
export type OccupancyStatus = z.infer<typeof occupancyStatusSchema>;

export interface OccupancyEvidence {
  kind: "motion_active" | "motion_cleared" | "door_opened" | "door_closed";
  atMs: number;
  source: "DEVICE" | "USER" | "AUTOMATION" | "SIMULATION" | "SYSTEM";
  deviceId?: string;
}

export interface OccupancyEstimate {
  status: OccupancyStatus;
  confidence: number;
  evidence: string[];
  updatedAtMs: number;
  simulated: boolean;
}

export interface OccupancyEvidenceInput {
  kind: OccupancyEvidence["kind"];
  atMs: number;
  source: OccupancyEvidence["source"];
  deviceId?: string;
}

const DECAY_HALF_LIFE_MS = 120_000;
const STALE_MS = 600_000;

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function decayConfidence(confidence: number, ageMs: number): number {
  if (ageMs <= 0) return confidence;
  const factor = 0.5 ** (ageMs / DECAY_HALF_LIFE_MS);
  return clampConfidence(confidence * factor);
}

function evidenceLabel(input: OccupancyEvidenceInput): string {
  switch (input.kind) {
    case "motion_active":
      return "motion sensor active";
    case "motion_cleared":
      return "motion cleared";
    case "door_opened":
      return "door opened";
    case "door_closed":
      return "door closed";
    default: {
      const _exhaustive: never = input.kind;
      return _exhaustive;
    }
  }
}

/**
 * Pure occupancy estimator — UNKNOWN/VACANT/OCCUPIED + confidence +
 * evidence strings, never an identified individual (ADR-010).
 */
export function estimateOccupancy(
  previous: OccupancyEstimate | undefined,
  input: OccupancyEvidenceInput,
  nowMs: number = input.atMs,
): OccupancyEstimate {
  const ageMs = Math.max(0, nowMs - (previous?.updatedAtMs ?? nowMs));
  const decayed = previous ? decayConfidence(previous.confidence, ageMs) : 0;
  const stale = !previous || nowMs - previous.updatedAtMs > STALE_MS;

  let status: OccupancyStatus = stale ? "UNKNOWN" : previous.status;
  let confidence = stale ? 0 : decayed;
  const evidence = [`${evidenceLabel(input)}`];
  const simulated = input.source === "SIMULATION" || Boolean(previous?.simulated);

  switch (input.kind) {
    case "motion_active":
      status = "OCCUPIED";
      confidence = clampConfidence(Math.max(decayed, 0.85));
      break;
    case "motion_cleared":
      if (status === "OCCUPIED" && confidence < 0.55) {
        status = "UNKNOWN";
        confidence = clampConfidence(Math.max(decayed * 0.5, 0.25));
      } else if (status === "OCCUPIED") {
        confidence = clampConfidence(decayed * 0.6);
      } else {
        status = "VACANT";
        confidence = clampConfidence(Math.max(decayed, 0.45));
      }
      break;
    case "door_opened":
      if (status === "VACANT" || status === "UNKNOWN") {
        status = "OCCUPIED";
        confidence = clampConfidence(Math.max(decayed, 0.55));
      } else {
        confidence = clampConfidence(Math.max(decayed, 0.7));
      }
      break;
    case "door_closed":
      if (status === "OCCUPIED") {
        confidence = clampConfidence(decayed * 0.85);
      } else {
        status = "UNKNOWN";
        confidence = clampConfidence(Math.max(decayed, 0.3));
      }
      break;
    default: {
      const _exhaustive: never = input.kind;
      return _exhaustive;
    }
  }

  // Conflicting low-confidence signals degrade to UNKNOWN.
  if (confidence < 0.2) {
    status = "UNKNOWN";
  }

  return {
    status,
    confidence: Number(confidence.toFixed(3)),
    evidence,
    updatedAtMs: nowMs,
    simulated,
  };
}

export function decayOccupancyEstimate(
  estimate: OccupancyEstimate,
  nowMs: number,
): OccupancyEstimate {
  const ageMs = Math.max(0, nowMs - estimate.updatedAtMs);
  const confidence = decayConfidence(estimate.confidence, ageMs);
  if (nowMs - estimate.updatedAtMs > STALE_MS || confidence < 0.2) {
    return {
      status: "UNKNOWN",
      confidence: Number(confidence.toFixed(3)),
      evidence: ["stale evidence"],
      updatedAtMs: estimate.updatedAtMs,
      simulated: estimate.simulated,
    };
  }
  return {
    ...estimate,
    confidence: Number(confidence.toFixed(3)),
  };
}

export function aggregatePropertyOccupancy(
  rooms: OccupancyEstimate[],
  nowMs: number,
): OccupancyEstimate {
  if (rooms.length === 0) {
    return {
      status: "UNKNOWN",
      confidence: 0,
      evidence: ["no room evidence"],
      updatedAtMs: nowMs,
      simulated: false,
    };
  }
  const live = rooms.map((room) => decayOccupancyEstimate(room, nowMs));
  const occupied = live.filter((room) => room.status === "OCCUPIED");
  if (occupied.length > 0) {
    const confidence = Math.max(...occupied.map((room) => room.confidence));
    return {
      status: "OCCUPIED",
      confidence,
      evidence: occupied.flatMap((room) => room.evidence).slice(0, 3),
      updatedAtMs: nowMs,
      simulated: live.some((room) => room.simulated),
    };
  }
  const vacant = live.filter((room) => room.status === "VACANT");
  if (vacant.length === live.length) {
    return {
      status: "VACANT",
      confidence: Math.min(...vacant.map((room) => room.confidence)),
      evidence: ["all rooms vacant"],
      updatedAtMs: nowMs,
      simulated: live.some((room) => room.simulated),
    };
  }
  return {
    status: "UNKNOWN",
    confidence: 0.2,
    evidence: ["ambiguous room evidence"],
    updatedAtMs: nowMs,
    simulated: live.some((room) => room.simulated),
  };
}
