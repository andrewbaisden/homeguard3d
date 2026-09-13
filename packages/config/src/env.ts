import { z } from "zod";

/**
 * Env vars every runtime (Vercel app, Fly.io realtime service) needs.
 * Runtime-specific schemas extend this rather than duplicating it —
 * see ARCHITECTURE.md "Deployment Architecture" for which runtime owns which vars.
 */
export const sharedEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  SENTRY_DSN: z.string().url().optional(),
});

export const webEnvSchema = sharedEnvSchema.extend({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  FLY_INGESTION_URL: z.string().url(),
  FLY_SERVICE_SECRET: z.string().min(16),
  NEXT_PUBLIC_REALTIME_SSE_URL: z.string().url(),
  POSTHOG_KEY: z.string().optional(),
});

export const realtimeServiceEnvSchema = sharedEnvSchema.extend({
  FLY_SERVICE_SECRET: z.string().min(16),
  PORT: z.coerce.number().int().positive().default(8080),
});

export type WebEnv = z.infer<typeof webEnvSchema>;
export type RealtimeServiceEnv = z.infer<typeof realtimeServiceEnvSchema>;

/**
 * Parses and returns a validated env object, or throws with a readable
 * message listing every missing/invalid variable. Call once at process
 * startup — never scatter raw `process.env` reads through the codebase.
 */
export function loadEnv<T extends z.ZodTypeAny>(
  schema: T,
  source: Record<string, string | undefined> = process.env,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
