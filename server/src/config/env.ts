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

  // ---- AI (Phase 10) --------------------------------------------------------
  // Vendor selection. The default is "anthropic" when a key is present and
  // "mock" otherwise. "disabled" turns the feature off entirely (button
  // hidden on the admin UI; endpoints return 404).
  AI_PROVIDER: z.enum(["anthropic", "mock", "disabled"]).optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("claude-sonnet-5"),
  AI_DRAFT_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(25_000),
  AI_TRANSLATE_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(15_000),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(256).max(8192).default(1500),
  // Per-user and per-org caps per calendar day (§17.3). Exceeded → the UI
  // shows "Feature disabled for the day". The log row still records the
  // attempt as `rate_limited` so operators can audit.
  AI_DAILY_USER_CAP: z.coerce.number().int().min(0).default(60),
  AI_DAILY_ORG_CAP: z.coerce.number().int().min(0).default(400),
  // Approximate dollar budget per org per day. We charge each call in
  // "credits" (roughly USD cents of tokens at the current model price). A
  // call is pre-charged before dispatch and refunded on provider error.
  AI_DAILY_ORG_CREDITS_CAP: z.coerce.number().int().min(0).default(500),

  // ---- Phase 11 — Children's future fund (private database) ---------------
  // Only the beneficiary module imports these. The connection is lazy, so
  // leaving them unset keeps the private system fully offline; endpoints
  // return 503 and no connection is attempted.
  MONGO_URI_PRIVATE: z.string().optional(),
  MONGO_DB_NAME_PRIVATE: z.string().default("sfuganda_private"),
  // Base64url 32-byte key material for AES-256-GCM. `_PREV` lets us rotate
  // without rewriting ciphertexts — new writes use the current key, reads
  // try current then previous. Both are read ONLY inside beneficiary/crypto.
  FIELD_ENCRYPTION_KEY: z.string().optional(),
  FIELD_ENCRYPTION_KEY_PREV: z.string().optional(),
  // Named-individual allow-list (§8). The founder is always on the list;
  // additional user ids go here (comma separated, no spaces). Policy
  // AND role AND presence here are all required to touch the module.
  BENEFICIARY_ACCESS_USER_IDS: z
    .string()
    .default("")
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),
  // Hard infrastructure gate. Reads/writes are refused until counsel's
  // sign-off is on file and this flag is explicitly set. Flipping it is a
  // conscious operations decision; it is NOT turned on by default on
  // migration up. (DoD: legal sign-off on file.)
  BENEFICIARY_LEGAL_SIGNOFF: boolish.default(false),
  // k-anonymity threshold for the public aggregate projection. Below this
  // beneficiary count, the public endpoint returns `suppressed: true` and
  // omits the total.
  BENEFICIARY_SUPPRESSION_K: z.coerce.number().int().min(1).max(50).default(5),
  // Step-up MFA window — fresh MFA within this many seconds before any
  // read or write of a beneficiary record.
  BENEFICIARY_STEPUP_TTL_SECONDS: z.coerce.number().int().min(60).max(1800).default(300),

  // ---- Phase 12 — Social cross-posting -----------------------------------
  // Master switch. Unset ⇒ connections and fan-out are inert; endpoints
  // say the feature is disabled. Operators flip this once at least one
  // platform's developer-app approval is on file.
  SOCIAL_ENABLED: boolish.default(false),
  // AES-256-GCM key for the token store (base64 32 bytes). Separate from
  // FIELD_ENCRYPTION_KEY so a key compromise in one domain doesn't bleed.
  SOCIAL_TOKEN_KEY: z.string().optional(),
  SOCIAL_TOKEN_KEY_PREV: z.string().optional(),
  // Public URL the OAuth callback resolves to (visible to the platform).
  // The route itself is `/v1/social/oauth/callback`; this is just the
  // host so we can build the full URL at auth-begin time.
  SOCIAL_OAUTH_CALLBACK_BASE: z.string().url().optional(),
  // Per-platform credentials. Each pair is optional — missing credentials
  // disables that platform's "Connect" button.
  YOUTUBE_CLIENT_ID: z.string().optional(),
  YOUTUBE_CLIENT_SECRET: z.string().optional(),
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
  INSTAGRAM_APP_ID: z.string().optional(),
  INSTAGRAM_APP_SECRET: z.string().optional(),
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
  // Max attempts for a single social post before the row goes `failed`.
  // Separate from the global worker MAX_ATTEMPTS so social can be more
  // conservative than, say, a cache-revalidate.
  SOCIAL_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(6),
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
