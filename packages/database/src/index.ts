import { PrismaClient } from "../generated/client/index.js";

declare global {
  // eslint-disable-next-line no-var
  var __homeguardPrisma: PrismaClient | undefined;
}

/**
 * Single shared Prisma client per process. Both the Vercel app and the
 * Fly.io realtime service import from this package rather than each
 * instantiating their own client against the same schema.
 */
export const prisma = globalThis.__homeguardPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__homeguardPrisma = prisma;
}

export * from "../generated/client/index.js";
