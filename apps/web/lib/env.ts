import { loadEnv, webEnvSchema } from "@homeguard/config/env";

/**
 * Validated environment for the Vercel app. Call sites import `env`
 * from here rather than reading `process.env` directly — see
 * AGENTS.md ("no scattered process.env access").
 *
 * Lazily parsed (not at module load) so `pnpm build`/`typecheck` don't
 * require a fully-populated `.env` in CI for a scaffold-only pass.
 */
let cached: ReturnType<typeof loadEnv<typeof webEnvSchema>> | undefined;

export function getEnv() {
  if (!cached) {
    cached = loadEnv(webEnvSchema);
  }
  return cached;
}
