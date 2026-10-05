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

  // ---- Media pipeline (Phase 2) --------------------------------------------
  // S3-compatible storage (Cloudflare R2). Three logical buckets:
  // originals (private), derivatives (public), documents (private, separate
  // origin per §14.3). Each may share an account/endpoint but MUST be
  // distinct buckets so lifecycle and ACLs can be set independently.
  R2_ENDPOINT: z.string().url().optional(),
  R2_REGION: z.string().default("auto"),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_ORIGINALS: z.string().default("sfu-originals"),
  R2_BUCKET_DERIVATIVES: z.string().default("sfu-derivatives"),
  R2_BUCKET_DOCUMENTS: z.string().default("sfu-documents"),
  // Public CDN origin that serves the derivatives bucket. Documents are
  // served from a separate signed-URL path and are NEVER on this origin.
  R2_PUBLIC_DERIVATIVES_URL: z.string().url().optional(),
  R2_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),
  R2_UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(7200).default(1800),
  // Hard caps on upload size by kind (§14.3). Bytes.
  MEDIA_MAX_PHOTO_BYTES: z.coerce.number().int().positive().default(25 * 1024 * 1024),
  MEDIA_MAX_DOCUMENT_BYTES: z.coerce.number().int().positive().default(50 * 1024 * 1024),
  MEDIA_MAX_VIDEO_BYTES: z.coerce.number().int().positive().default(2 * 1024 * 1024 * 1024),
  // Cloudflare Stream integration (video provider).
  STREAM_ACCOUNT_ID: z.string().optional(),
  STREAM_API_TOKEN: z.string().optional(),
  STREAM_WEBHOOK_SECRET: z.string().optional(),
  // Malware scanner sidecar — HTTP endpoint of a ClamAV REST shim or ICAP
  // gateway. Required in production; stubbed in dev when unset.
  MALWARE_SCANNER_URL: z.string().url().optional(),
  MALWARE_SCANNER_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),

  // ---- Finance (Phase 4) ----------------------------------------------------
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  // Seed for the ledger hash chain. If unset in dev, a static value is used
  // so repeated test runs produce deterministic chains.
  LEDGER_HASH_SEED: z.string().min(16).default("sfu-ledger-dev-seed-0000000000000"),
  BASE_CURRENCY: z.string().length(3).default("USD"),
  // Phase 6
  DUAL_APPROVAL_THRESHOLD_CENTS: z.coerce.number().int().positive().default(500_000),
  FX_RATE_SOURCE_URL: z.string().url().optional(),
  FX_RATE_SOURCE_NAME: z.string().default("exchangerate.host"),
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
