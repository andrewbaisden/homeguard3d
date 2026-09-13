import "server-only";

import { getCurrentUserId } from "@/lib/session";
import { requirePropertyAccess } from "@homeguard/auth";
import type { Role } from "@homeguard/database";

/**
 * The single entry point every property-scoped Server Component/action
 * in apps/web calls through — see AGENTS.md rule #4. Never call
 * `requirePropertyAccess` directly with an inline session read.
 */
export async function requireAccess(propertyId: string, minRole: Role = "VIEWER") {
  const userId = await getCurrentUserId();
  return requirePropertyAccess(userId ?? undefined, propertyId, minRole);
}
