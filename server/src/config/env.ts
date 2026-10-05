import { z } from "zod";

// =============================================================================
// Environment validation. Loaded once on boot. If anything is wrong, the
// process exits before serving a single request.
// =============================================================================

const boolish = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === "boolean" ? v : /^(1|true|yes|on)$/i.test(v)));

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),

  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 chars"),
  SESSION_COOKIE_NAME: z.string().default("sfu_session"),
  SESSION_COOKIE_DOMAIN: z.string().optional().transform((v) => (v && v.length > 0 ? v : undefined)),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  SESSION_COOKIE_SECURE: boolish.default(false),

  MONGO_URI: z.string().url().or(z.string().startsWith("mongodb")),
  MONGO_DB_NAME: z.string().default("sfuganda"),

  MAIL_FROM: z.string().min(1),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: boolish.default(false),

  PUBLIC_SITE_URL: z.string().url(),

  STRIPE_SECRET_KEY: z.string().min(1).optional(),

  INTERNAL_PROXY_SECRET: z.string().min(16, "INTERNAL_PROXY_SECRET must be at least 16 chars"),

  MFA_ISSUER: z.string().default("Sarah's Foundation"),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
    // eslint-disable-next-line no-console
    console.error("Invalid environment:\n" + issues);
    process.exit(1);
  }
  return parsed.data;
}

export const env: Env = loadEnv();

export function isProd(): boolean {
  return env.NODE_ENV === "production";
}
