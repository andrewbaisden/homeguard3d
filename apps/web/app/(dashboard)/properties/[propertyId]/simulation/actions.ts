"use server";

import {
  SimulationRequestError,
  getSimulationStatus as fetchSimulationStatus,
  postSimulationControl,
} from "@/lib/simulation";
import { requireAccess } from "@/server/authz";
import type { SimulationControl, SimulationStatus } from "@homeguard/domain";
import { revalidatePath } from "next/cache";

/**
 * Simulation controls emit operational events (including arm/alarm paths
 * for Intrusion), so MEMBER+ — same bar as arm/disarm. VIEWER can watch
 * but not start a run.
 */
const SIMULATION_MIN_ROLE = "MEMBER" as const;

function simulationPath(propertyId: string) {
  return `/properties/${propertyId}/simulation`;
}

export async function getSimulationStatus(propertyId: string): Promise<SimulationStatus> {
  await requireAccess(propertyId, "VIEWER");
  try {
    return await fetchSimulationStatus(propertyId);
  } catch (error) {
    throw error instanceof SimulationRequestError
      ? error
      : new Error("Failed to reach the realtime service.");
  }
}

export async function controlSimulation(
  propertyId: string,
  control: SimulationControl,
): Promise<SimulationStatus> {
  await requireAccess(propertyId, SIMULATION_MIN_ROLE);
  try {
    const status = await postSimulationControl(propertyId, control);
    revalidatePath(simulationPath(propertyId));
    revalidatePath(`/properties/${propertyId}`);
    return status;
  } catch (error) {
    throw error instanceof SimulationRequestError
      ? error
      : new Error("Failed to reach the realtime service.");
  }
}
