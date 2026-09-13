import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TTL_MS = 5 * 60 * 1000;

interface RealtimeTokenPayload {
  propertyId: string;
  expiresAt: number;
}

function signatureFor(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Creates a short-lived, property-scoped token safe to expose to a browser. */
export function createRealtimeToken(
  propertyId: string,
  secret: string,
  nowMs = Date.now(),
  ttlMs = DEFAULT_TTL_MS,
): string {
  if (!propertyId || ttlMs <= 0) throw new Error("Invalid realtime token input");
  const payload: RealtimeTokenPayload = { propertyId, expiresAt: nowMs + ttlMs };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${signatureFor(encoded, secret)}`;
}

/** Verifies signature, expiry, and exact property scope in constant time. */
export function verifyRealtimeToken(
  token: string | undefined,
  expectedPropertyId: string,
  secret: string,
  nowMs = Date.now(),
): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [encoded, suppliedSignature] = parts;
  if (!encoded || !suppliedSignature) return false;

  const expectedSignature = signatureFor(encoded, secret);
  const suppliedBuffer = Buffer.from(suppliedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as unknown;
    if (!payload || typeof payload !== "object") return false;
    if (!("propertyId" in payload) || !("expiresAt" in payload)) return false;
    return (
      payload.propertyId === expectedPropertyId &&
      typeof payload.expiresAt === "number" &&
      Number.isFinite(payload.expiresAt) &&
      payload.expiresAt > nowMs
    );
  } catch {
    return false;
  }
}
