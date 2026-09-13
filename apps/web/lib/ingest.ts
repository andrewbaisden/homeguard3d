import "server-only";
import { getEnv } from "./env";

export interface IngestResponse {
  status: "applied" | "duplicate" | "stale" | "rejected";
  eventId: string;
  propertyId: string;
  rejectedReason?: string;
  rejectedDeviceIds?: string[];
}

export class IngestRequestError extends Error {}

/**
 * The one place apps/web ever changes operational state — a call into
 * the realtime service's synchronous ingestion pipeline (the same one
 * Phase 3/4's device events go through), never a direct Prisma write
 * to Device/SecurityState columns. See ARCHITECTURE.md section J and
 * AGENTS.md rule #1.
 */
export async function postEvent(event: Record<string, unknown>): Promise<IngestResponse> {
  const env = getEnv();

  const response = await fetch(`${env.FLY_INGESTION_URL}/internal/ingest`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-service-secret": env.FLY_SERVICE_SECRET,
    },
    body: JSON.stringify(event),
  });

  const body: unknown = await response.json();
  if (body && typeof body === "object" && "error" in body) {
    const message = "message" in body && typeof body.message === "string" ? body.message : null;
    throw new IngestRequestError(message ?? String(body.error));
  }

  return body as IngestResponse;
}
