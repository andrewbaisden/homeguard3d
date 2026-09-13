import "server-only";
import {
  type SimulationControl,
  type SimulationStatus,
  simulationStatusSchema,
} from "@homeguard/domain";
import { getEnv } from "./env";

export class SimulationRequestError extends Error {}

async function parseStatus(response: Response): Promise<SimulationStatus> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message
        : `Simulation request failed (${response.status})`;
    throw new SimulationRequestError(message);
  }

  const parsed = simulationStatusSchema.safeParse(body);
  if (!parsed.success) {
    throw new SimulationRequestError("Realtime service returned an invalid simulation status.");
  }
  return parsed.data;
}

export async function getSimulationStatus(propertyId: string): Promise<SimulationStatus> {
  const env = getEnv();
  const response = await fetch(`${env.FLY_INGESTION_URL}/internal/simulation/${propertyId}`, {
    headers: { "x-service-secret": env.FLY_SERVICE_SECRET },
    cache: "no-store",
  });
  return parseStatus(response);
}

export async function postSimulationControl(
  propertyId: string,
  control: SimulationControl,
): Promise<SimulationStatus> {
  const env = getEnv();
  const response = await fetch(
    `${env.FLY_INGESTION_URL}/internal/simulation/${propertyId}/control`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-service-secret": env.FLY_SERVICE_SECRET,
      },
      body: JSON.stringify(control),
      cache: "no-store",
    },
  );
  return parseStatus(response);
}
