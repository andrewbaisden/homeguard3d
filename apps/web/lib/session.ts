import "server-only";

import { auth } from "@homeguard/auth";
import { headers } from "next/headers";

/**
 * The one place Server Components / server actions read the current
 * Better Auth session from. Never read cookies or call
 * `auth.api.getSession` ad hoc elsewhere — see AGENTS.md.
 */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Returns the current user's id, or null if not signed in. */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user.id ?? null;
}
