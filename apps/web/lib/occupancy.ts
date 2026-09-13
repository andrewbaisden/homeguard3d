import "server-only";
import type { OccupancyEstimate } from "@homeguard/domain";
import { EMPTY_OCCUPANCY, type OccupancyOperationalState } from "@homeguard/state";
import { getEnv } from "./env";

export async function fetchOccupancySnapshot(
  propertyId: string,
): Promise<OccupancyOperationalState> {
  const env = getEnv();
  try {
    const response = await fetch(`${env.FLY_INGESTION_URL}/internal/occupancy/${propertyId}`, {
      headers: { "x-service-secret": env.FLY_SERVICE_SECRET },
      cache: "no-store",
    });
    if (!response.ok) return EMPTY_OCCUPANCY;
    const body = (await response.json()) as {
      property: OccupancyEstimate;
      rooms: Record<string, OccupancyEstimate>;
    };
    return {
      status: body.property.status,
      confidence: body.property.confidence,
      evidence: body.property.evidence,
      updatedAtMs: body.property.updatedAtMs,
      simulated: body.property.simulated,
      rooms: body.rooms,
    };
  } catch {
    return EMPTY_OCCUPANCY;
  }
}
