import { prisma } from "@homeguard/database";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

/**
 * Better Auth instance, self-hosted and Postgres-backed via the shared
 * Prisma client. Mounted at apps/web/app/api/auth/[...all]/route.ts.
 *
 * Email+password only for the Phase 1 scaffold; a single OAuth
 * provider (e.g. GitHub) can be added later for portfolio-demo
 * convenience without changing this shape.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
});
