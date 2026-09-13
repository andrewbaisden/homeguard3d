"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Browser-side Better Auth client. Server Components / server actions
 * use `auth.api.getSession()` from @homeguard/auth directly instead —
 * see src/lib/session.ts.
 */
export const authClient = createAuthClient();
