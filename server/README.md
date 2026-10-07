# Sarah's Foundation — API (`server/`)

Phase 1 platform foundation: Express API + outbox worker, MongoDB (replica
set), identity, RBAC, audit, and the admin shell's data plane.

## Layering (§10.1)

```
server/src/
  app.ts            express app: helmet, CORS allow-list, body limits, request id, error handler
  server.ts         API entrypoint — connects DB, listens, graceful shutdown
  config/           env (zod-validated), db
  middleware/       requestContext (id + origin + internal secret), authMiddleware
  routes/           thin: parse (zod) → authenticate → call service → map errors
  services/         business rules, Mongo transactions, policy checks, audit, outbox
  policy/           can(actor, action, resource) — the only place permissions are decided
  models/           Mongoose schemas with strict: "throw"
  worker/           outbox handlers + poll loop (second process, same code)
  mail/             nodemailer wrapper + templates
  util/             errors, log, ids, money (int64)
migrations/         indexes, validators, DB users; `run.ts` and `seed.ts`
tests/              policy matrix, auth flow, append-only, money, migration
```

Rules:

- Route files contain **no business logic**.
- Services never trust a role or organisation ID from the request body.
- Every mutating service method that touches more than one document runs
  inside one MongoDB transaction that also writes the audit entry and any
  outbox events.
- The Next.js front end (`../src/`) **never imports from `server/`**, and
  the front end holds no database credentials.

## Local development

```bash
# From repo root — bring up Mongo (replica set) + Mailpit + API + worker.
docker compose up -d mongo mailpit
cd server
cp .env.example .env
npm install
npm run migrate     # creates collections, validators, indexes, DB roles
SEED_FOUNDER_EMAIL=founder@sfuganda.local \
  SEED_FOUNDER_PASSWORD="FounderPassword!1" \
  npm run seed      # bootstrap organisation + founder user + founder role

# One terminal for the API:
npm run dev
```

> **Outbox worker is temporarily disabled.** The code under `src/worker/`
> is still present but is no longer launched by `package.json` or
> `docker-compose.yml`, because there is no budget for a second always-on
> process on the hosting plan. Outbox-driven features (notification
> emails, scheduled monthly reports, media post-processing, social
> cross-posting) will queue up `outbox_events` rows but will not process
> them until the worker is re-enabled by restoring the `dev:worker` /
> `start:worker` scripts and uncommenting the `worker` service in
> `docker-compose.yml`.

Mailpit at <http://localhost:8025> catches every outbound email.

## Environment

All variables are declared in [src/config/env.ts](src/config/env.ts) and
validated at boot. Missing or malformed values cause the process to exit
before serving a single request.

See [.env.example](.env.example) for the complete list.

## Endpoints (Phase 1 subset of §10.3)

| Method · Path                            | Access  | Purpose                                 |
|------------------------------------------|---------|-----------------------------------------|
| `GET  /health/live`                      | PUBLIC  | liveness                                |
| `GET  /health/ready`                     | PUBLIC  | readiness (DB connected)                |
| `POST /v1/auth/sign-in`                  | PUBLIC  | email + password → session cookie       |
| `POST /v1/auth/sign-out`                 | AUTH    | revoke the current session              |
| `POST /v1/auth/mfa/enrol`                | AUTH    | begin TOTP enrolment                    |
| `POST /v1/auth/mfa/verify-enrol`         | AUTH    | confirm the TOTP + emit recovery codes  |
| `POST /v1/auth/mfa/verify`               | AUTH    | mark the current session MFA-verified   |
| `POST /v1/auth/invite/accept`            | PUBLIC  | activate the invited account            |
| `GET  /v1/me`                            | AUTH    | profile, assignments, mfa_verified      |
| `GET  /v1/admin/users`                   | FOUNDER / DIRECTOR | list                           |
| `POST /v1/admin/users/invite`            | FOUNDER / DIRECTOR | invite + assign                |
| `PATCH /v1/admin/users/:id/roles`        | FOUNDER / DIRECTOR | add a scoped role              |
| `DELETE /v1/admin/users/roles/:id`       | FOUNDER / DIRECTOR | revoke                         |
| `POST /v1/admin/users/:id/suspend`       | FOUNDER | suspend                                 |
| `POST /v1/admin/users/:id/reinstate`     | FOUNDER | reinstate                               |
| `GET  /v1/audit`                         | FOUNDER / DIRECTOR | append-only audit                    |
| `POST /v1/donations/checkout`            | PUBLIC  | Stripe Checkout session (hardened)      |
| `POST /v1/volunteers`                    | PUBLIC  | volunteer signup                        |

Error shape (§10.2):

```json
{ "error": { "code": "forbidden", "message": "...", "fields": { "...": "..." } }, "request_id": "..." }
```

## Testing

```bash
npm test                 # vitest — authz, auth flow, append-only, money, migration
```

- `policy.test.ts` — exhaustive RBAC matrix.
- `auth.flow.test.ts` — end-to-end sign-in → invite → field-member 403.
- `appendOnly.test.ts` — enforces the service contract around `audit_log`.
- `money.test.ts` — proves int64 round-trip precision end-to-end **before any
  finance code is written** (Phase 1 risk mitigation).
- `migration.test.ts` — initial migration applies cleanly to an empty DB and
  is idempotent on a second run.
- `sustainability.test.ts` (Phase 8) — the sustainability ratio excludes
  donations from the numerator and non-operating categories from the
  denominator; the exposed ledger rows hand-recompute the figure.
- `communityCoords.test.ts` (Phase 8) — no public response ever carries
  coordinates with more than one decimal of precision; stored values are
  snapped on save and rounded again on read.

## Phase 8 — businesses, production, sustainability (§6, §9, §10, §11)

New routes:

| Method · Path                                      | Access               | Purpose                                   |
|----------------------------------------------------|----------------------|-------------------------------------------|
| `GET  /v1/admin/businesses`                        | staff                | list businesses                           |
| `POST /v1/admin/businesses`                        | founder/director/pm  | create a business                         |
| `PATCH /v1/admin/businesses/:id`                   | founder/director/pm  | edit                                      |
| `POST /v1/admin/businesses/:id/approve`            | founder/director     | publish                                   |
| `POST /v1/admin/businesses/:id/retire`             | founder/director     | retire                                    |
| `GET  /v1/admin/businesses/production/list`        | staff                | production queue                          |
| `POST /v1/admin/businesses/production`             | pm / field / fm      | submit a production record                |
| `POST /v1/admin/businesses/production/:id/approve` | director/founder/fm  | approve + post balanced ledger entry      |
| `POST /v1/admin/businesses/production/:id/reject`  | director/founder/fm  | reject with reason                        |
| `GET  /v1/public/sustainability?community&months`  | PUBLIC               | monthly ratio + raw ledger rows           |
| `GET  /v1/public/businesses`                       | PUBLIC               | list of approved businesses               |
| `GET  /v1/public/communities/:slug`                | PUBLIC               | community detail (coarse coords only)     |

Rules:

- Separation of duties: the production record submitter cannot be the
  approver. The approver's action posts a balanced DR cash / CR
  `revenue_business` transaction tagged with `business_id` — so the
  sustainability aggregator reads the ledger alone and never a separate
  revenue table.
- The sustainability numerator is credit-side rows on `revenue_business`.
  Donations are structurally excluded (`donations_received` and
  `contribution_*` accounts). The denominator is debit-side `expense_*`
  rows whose expense_category is flagged `is_operating`.
- The public sustainability endpoint ships the raw rows it summed from — a
  visitor can recompute the figure by hand (Phase 8 definition of done).
- Community coordinates are snapped to one decimal (≈11 km) in the schema
  AND re-rounded on the public read path.

## Phase 9 — reports and PDF (§16)

New routes:

| Method · Path                                      | Access                        | Purpose                                                |
|----------------------------------------------------|-------------------------------|--------------------------------------------------------|
| `GET  /v1/admin/reports`                           | staff                         | list reports (any state)                               |
| `POST /v1/admin/reports`                           | founder/director/pm/media_mgr | create a draft for a period                            |
| `GET  /v1/admin/reports/:id`                       | staff                         | detail including the frozen snapshot                   |
| `PATCH /v1/admin/reports/:id`                      | founder/director/pm/media_mgr | edit editorial surface (resets state to `draft`)       |
| `POST /v1/admin/reports/:id/compile`               | founder/director/pm/media_mgr | compile a fresh snapshot (clears finance signature)    |
| `POST /v1/admin/reports/:id/sign-finance`          | founder/finance_manager       | sign the financial section                             |
| `POST /v1/admin/reports/:id/approve`               | founder/director              | approve for publication                                |
| `POST /v1/admin/reports/:id/publish`               | founder/director              | publish; revalidates `public:reports`                  |
| `POST /v1/admin/reports/:id/archive`               | founder/director              | archive                                                |
| `POST /v1/admin/reports/:id/export`                | any editor + finance          | enqueue a PDF export                                   |
| `GET  /v1/public/reports`                          | PUBLIC                        | published reports with latest ready export             |
| `GET  /v1/public/reports/:id/download`             | PUBLIC                        | short-lived signed PDF URL (R2 "documents" bucket)     |

Rules:

- **Reports read only public projections.** The compiler walks
  `ledger_entries`, `accomplishments` (state=published), `communities`
  (status=active), `funds`, and `projects`. It never joins private tables
  and no PII leaves the function.
- **Snapshot is immutable.** Once compiled, the figures and the content
  hash are frozen. Any editorial edit returns the report to `draft` and
  clears the finance signature — the compiler must run again.
- **Separation of duties.** The author (`created_by`), the finance signer,
  and the approver must be three different people. The service refuses the
  transition if two of them coincide.
- **PDF is tagged.** Rendered via pdfkit with `tagged: true`, `lang: en-US`,
  and a Document → H1/H2/P/L structure tree so screen readers follow
  reading order. The content hash + compiler version appear in the PDF so
  a reader can tie the file back to the admin UI.
- **Scheduled monthly draft.** The worker loop ticks a scheduler every
  15 min; on the first tick of a new month it enqueues
  `report.schedule_monthly` with the previous period code. The handler
  creates the draft (idempotent against the unique `(org, period_code)`
  index) and compiles it, leaving it in `compiled` state for human review.

New tests:

- `reportSnapshot.test.ts` — snapshot aggregates equal the in-period ledger
  aggregates; the content hash is deterministic.
- `reportPdf.test.ts` — PDF is valid, tagged, lang-tagged (`en-US`), and the
  formatted finance figures appear verbatim.
- `reportPolicy.test.ts` — role separation across author / finance / approve
  / publish (plus MFA requirement).

## Phase 10 — AI assistant and video summaries (§17, R-D)

- `services/ai/provider.ts` — `DraftingProvider` interface + default
  Anthropic adapter (`claude-sonnet-5` by default), `MockProvider` (used
  in CI and when `ANTHROPIC_API_KEY` is unset), `DisabledProvider`.
- `services/ai/validators.ts` — number/date/currency/named-entity
  extraction + `validateDraft()` and `maskNames()`. The output of
  the model is compared span-by-span against the input snapshot; any
  value not seen in the input is flagged for the reviewer.
- `services/ai/caps.ts` — per-user, per-org, and per-org-credits daily
  caps. Rate-limited calls return HTTP 429 so the UI can show the
  "disabled for the day" message.
- `services/ai/draft.ts` — assembles the input, masks person names,
  dispatches to the provider, validates the response, writes the
  `ai_generations` row, and returns the response plus a name-swap map
  for the UI. `recordAcceptance()` flips `ai_assisted = true` on the
  accomplishment, which arms the publish-time attestation gate.
- `services/ai/videoSummary.ts` — transcript upsert, English summary
  drafting, and public translation lookup (cached per
  `(video, language)` keyed by a content hash of the English source).
- `routes/ai.ts` — authenticated endpoints: `GET /v1/ai/status`,
  `POST /v1/ai/draft/accomplishment`,
  `POST /v1/ai/draft/acceptance`,
  `POST /v1/ai/draft/video-summary`,
  `PUT  /v1/ai/video-summary`,
  `GET  /v1/ai/logs` (founder-only, §17.4).
- `routes/videoSummaries.ts` — public endpoint
  `GET /v1/public/videos/:id/summary?lang=xx`. Supported languages are an
  allow-list in the module.
- Worker: `ai.video_transcribe` fetches captions from Cloudflare Stream
  and writes a `video_captions` row (idempotent on
  `(asset, language)`).
- Models: `AiGeneration`, `VideoCaption`, `VideoTranslation`;
  `Accomplishment` gains `ai_assisted`, `ai_generation_ids`,
  `ai_attestation_by`, `ai_attestation_at`.
- Policy: `ai.draft` (staff only, MFA required), `ai.read_log`
  (founder-only, MFA required).

Env (all optional — defaults are safe):

- `AI_PROVIDER` — `anthropic` | `mock` | `disabled`
- `ANTHROPIC_API_KEY`, `AI_MODEL` (default `claude-sonnet-5`)
- `AI_DRAFT_TIMEOUT_MS` (default 25000),
  `AI_TRANSLATE_TIMEOUT_MS` (default 15000),
  `AI_MAX_OUTPUT_TOKENS` (default 1500)
- `AI_DAILY_USER_CAP`, `AI_DAILY_ORG_CAP`, `AI_DAILY_ORG_CREDITS_CAP`

Publication gate: once `ai_assisted = true`, the `approve` and `publish`
transitions require `ai_attestation: true`. The service stamps
`ai_attestation_by` and `ai_attestation_at` the first time it is set,
which is written to `approval_events` through the normal transition
machinery.

New tests:

- `aiValidators.test.ts` — numeric / date / name extraction and
  `validateDraft` fixtures, including the DoD scenario (an injected
  number is flagged).
- `aiAttestation.test.ts` — `ai_assisted` cannot approve or publish
  without the attestation.
- `aiProvider.test.ts` — provider contract: successful draft is
  logged with tokens, timeout produces a shaped error that the caller
  surfaces, names are masked before the provider is called, daily cap
  enforcement.
- `aiPolicy.test.ts` — `ai.draft` / `ai.read_log` matrix with MFA.

## Phase 11 — Children's future fund (§8, §19.3, legal-gated)

Hard rules enforced in code:

- **Separate private database**, with its own connection, user, and
  credentials. Only `src/beneficiary/*` imports them. The main-DB and
  worker code paths cannot read them.
- **Field-level encryption** (AES-256-GCM) for every beneficiary name,
  date of birth, guardian, and note. `FIELD_ENCRYPTION_KEY` is a 32-byte
  base64 string loaded by `src/beneficiary/crypto.ts` and nothing else;
  rotation uses `FIELD_ENCRYPTION_KEY_PREV`.
- **Named-individual allow-list**: `BENEFICIARY_ACCESS_USER_IDS` must
  contain the user id of every person permitted to touch the module,
  AND the actor must hold `founder` or `safeguarding_lead`, AND the
  session must have passed step-up MFA (fresh TOTP within 5 min).
- **No cross-connection transactions.** The private module commits
  first; on approve/reverse it writes the public aggregate via
  `BeneficiaryFundSummary` in the MAIN DB. If the main-DB write fails,
  the next approve/reverse recomputes.
- **k-anonymity suppression** at the public endpoint
  (`BENEFICIARY_SUPPRESSION_K`, default 5). Below the threshold the
  endpoint returns `suppressed: true` and omits totals as well as the
  count.
- **Legal gate**: `BENEFICIARY_LEGAL_SIGNOFF=true` is required or the
  private connection is never opened; endpoints return 503 (DoD).

Modules:

- `beneficiary/db.ts` — lazy private `mongoose.Connection`.
- `beneficiary/crypto.ts` — AES-256-GCM + non-reversible fingerprint for
  indexed lookup. `generateKeyBase64()` is a helper for ops to mint
  rotation keys off-line.
- `beneficiary/models.ts` — three schemas: `beneficiary_private_records`,
  `beneficiary_fund_transactions`, `beneficiary_audit_log`. All attach
  to the private connection; none appear in `src/models/index.ts`.
- `beneficiary/stepUp.ts` — middleware that checks
  `session.step_up_verified_at` is within `BENEFICIARY_STEPUP_TTL_SECONDS`.
- `beneficiary/service.ts` — add/get/list; submit / approve (founder) /
  reject / reverse; `publicAggregate()` for the admin UI (same shape as
  the public endpoint, same suppression). Every call writes a row to
  `beneficiary_audit_log` in the private DB — reads too (§19.3).

Routes:

- `POST /v1/beneficiaries/step-up` — accepts a 6-digit TOTP; stamps
  `step_up_verified_at` on the session.
- `GET  /v1/beneficiaries` — list ref codes and status; one audit row.
- `POST /v1/beneficiaries` — add a child (encrypted at write time).
- `GET  /v1/beneficiaries/:id` — one record decrypted; audit row names
  the fields the actor viewed.
- `POST /v1/beneficiaries/transactions` — submit a pending tx.
- `GET  /v1/beneficiaries/transactions/pending` — queue.
- `POST /v1/beneficiaries/transactions/:id/approve` — founder only;
  recomputes the public summary.
- `POST /v1/beneficiaries/transactions/:id/reject`.
- `POST /v1/beneficiaries/transactions/:id/reverse` — founder only,
  reason required; writes a mirror row.
- `GET  /v1/public/children-fund/summary` — the ONLY public endpoint
  that mentions this fund. Reads `beneficiary_fund_summaries` from the
  MAIN DB (never the private DB).

Env:

- `MONGO_URI_PRIVATE`, `MONGO_DB_NAME_PRIVATE` (default `sfuganda_private`).
- `FIELD_ENCRYPTION_KEY`, optional `FIELD_ENCRYPTION_KEY_PREV`.
- `BENEFICIARY_ACCESS_USER_IDS=<id>,<id>,...`
- `BENEFICIARY_LEGAL_SIGNOFF=true` (off by default).
- `BENEFICIARY_SUPPRESSION_K=5` (adjustable).
- `BENEFICIARY_STEPUP_TTL_SECONDS=300`.

Migrations:

- `migrations/0011_phase11.ts` — main DB (just the public summary).
- `migrations/private/0001_private.ts` — private DB. Run with
  `npm run migrate:private` under the beneficiary user; this script
  authenticates against the private cluster only.

Tests:

- `beneficiariesIsolation.test.ts` — C5 scan: no public route transitively
  imports `src/beneficiary/*`. Any violation names the offending file.
- `beneficiariesPolicy.test.ts` — role matrix: every role outside
  {founder, safeguarding_lead} is denied private actions; MFA required.
- `beneficiariesCrypto.test.ts` — round-trip, IV uniqueness, tamper
  detection, previous-key fallback on rotation, refusal when the key
  is missing or not 32 bytes.
- `beneficiariesSuppression.test.ts` — public reader returns
  `suppressed: true` below the k threshold and only exposes totals at
  or above it.

## Phase 12 — Social cross-posting (§14.7, R-C)

Shipping surface:

- Models `social_connections` and `social_posts` in the main DB.
- `services/socialTokens.ts` — AES-256-GCM for OAuth tokens using
  `SOCIAL_TOKEN_KEY` (base64 32 bytes). Separate from the
  beneficiary field key — a key compromise in one domain doesn't
  bleed into the other. Rotation via `SOCIAL_TOKEN_KEY_PREV`.
- `services/social/publishers.ts` — a `SocialPublisher` interface
  with real adapters for YouTube, Facebook, Instagram, and TikTok
  plus a deterministic `MockPublisher` the registry falls back to
  when a platform's credentials are absent (so the operator flow is
  testable before developer-app approvals land — TD-12).
- `services/social/connections.ts` — OAuth begin / callback,
  HMAC-signed state, encrypted token storage, reconnect, revoke,
  and `liveAccessToken()` that refreshes if the token is near
  expiry.
- `services/social/fanout.ts` — `fanOutAccomplishment()` enqueues
  one `social.post` per (video, connection) with per-connection
  consent checked at fan-out time; `processSocialPost()` runs
  inside the worker and distinguishes retryable from terminal
  failures (`invalid_grant` without refresh → flip the connection
  to `error` so the admin page says "reconnect required").
- Routes under `/v1/social/*`:
    - `GET  /platforms` — which adapters are configured.
    - `GET  /connections`, `POST /connections/:platform/begin`,
      `GET /oauth/:platform/callback`, `POST /connections/:id/revoke`.
    - `GET  /posts`, `POST /posts/:id/retry`.
- Accomplishments publish now enqueues
  `social.fanout_accomplishment_published` alongside the existing
  cache-revalidate and notification events. **Failure isolation**
  (§14.7): a social failure never rolls back or edits the published
  accomplishment. The post row stores the error, surfaces in the
  admin screen, and the operator retries.

Consent model:

- Linked `ConsentRecord` (via a `MediaLink.target = "consent_record"`)
  takes precedence per asset; `scope.social` must be true and the
  record unrevoked / unexpired.
- With no linked consent, we fall back to a single org-level
  `ConsentRecord` with `subject_identifier = "org:social"`. Without
  that row the fan-out writes a `skipped` SocialPost with
  `skip_reason: "no social consent"`.

Env:

- `SOCIAL_ENABLED=true` (master switch; default false).
- `SOCIAL_TOKEN_KEY`, optional `SOCIAL_TOKEN_KEY_PREV`.
- `SOCIAL_OAUTH_CALLBACK_BASE` (default: `PUBLIC_SITE_URL`).
- `YOUTUBE_CLIENT_ID/SECRET`, `FACEBOOK_APP_ID/SECRET`,
  `INSTAGRAM_APP_ID/SECRET`, `TIKTOK_CLIENT_KEY/SECRET`.
- `SOCIAL_MAX_ATTEMPTS=6` (per-row cap, orthogonal to the outbox
  worker's own retry budget).

Tests:

- `socialPolicy.test.ts` — role matrix: media_manager/director/founder
  may connect & retry; project_manager reads only; everyone else
  refused; MFA required.
- `socialTokens.test.ts` — AES-GCM round-trip, rotation via
  `_PREV`, tamper detection.
- `socialFanout.test.ts` — one row per (video × connection); skip
  when org `social` consent is missing; per-media consent denies
  override; idempotency; success → `posted`; `invalid_grant` →
  `failed` AND connection flips to `error` (site publication
  unaffected — failure isolation); `transient` → re-queued.

## Phase 13 — Multi-organisation productisation (R-F)

Tenancy:

- `models/Organization.ts` gains `domains: string[]`, `branding`, and
  `inter_org` flags.
- `services/tenancy.ts` resolves a host to an Organization via exact
  match on `domains` with a 60-second in-memory cache. Fallbacks (in
  order): `MULTI_TENANT_DEFAULT_SLUG`, single-tenant singleton,
  404.
- `middleware/tenant.ts` runs after `attachAuth` and populates
  `req.org = { id, slug, name, base_currency, branding, domains }`.
- `routes/_shared.ts` exposes `tenantOrgId(req)` for public reads;
  the public portal, videos, video summaries, children-fund summary
  and volunteers routes all route through it (falling back to the
  pre-Phase-13 "first org" heuristic for single-tenant installs).

Branding:

- `GET /v1/public/branding` returns the tenant's display name,
  tagline, hero copy, accent colour, and footer line.
- `src/lib/branding.ts` (Next.js) consumes the endpoint from Server
  Components and merges it with the fallback in `data/content.ts`.
- `PATCH /v1/admin/organization/branding` (founder only) with zod
  validation; `clearTenantCache()` on save.
- `PATCH /v1/admin/organization/domains` (founder only) runs inside
  a transaction that refuses a host already owned by another org.

Pay-it-forward (inter-org transfers):

- `models/InterOrgTransfer.ts` — pending → posted/failed/cancelled.
  Unique index on `(from_organization_id, idempotency_key)` makes a
  replay return the same row.
- `services/interOrgTransfers.ts::initiateTransfer` posts two
  ledger_entries (one per org) in a single Mongo transaction, each
  anchored to the respective organisation's hash chain (separate
  seed-salt `${LEDGER_HASH_SEED}:interorg`). Refuses: self-transfer,
  restricted/endowed source or destination funds, currency mismatch,
  missing consent, insufficient balance. Updates both funds'
  denormalised balances inside the same transaction.
- Founder-only (`organization.transfer_send`); the submitter can
  never approve their own transfer because this operation has no
  separate approval step — the policy restricts origination itself.

Policy:

- New actions `organization.manage` and `organization.transfer_send`;
  both founder-only and MFA-required.
- New role `safeguarding_lead` already added in Phase 11 is still
  the only alternative "staff" role; multi-org deployments share the
  same role vocabulary.

Env:

- `MULTI_TENANT_DEFAULT_SLUG` (optional) — slug of the organisation
  to use when the Host header matches nothing. Useful during a
  rollout where one host still points at the legacy single-tenant
  instance.

Migration `0013_phase13.ts`:

- Adds the multikey index on `organizations.domains` and creates
  `inter_org_transfers` with its validator and three indexes.

Tests:

- `tenancyPolicy.test.ts` — only founders may manage the org or
  originate transfers; MFA required.
- `tenancyIsolation.test.ts` — seeds two complete organisations;
  resolves each host to the right org (case-/port-insensitive);
  returns `null` for unmapped hosts when > 1 org exists; checks
  seven tenant-scoped collections for zero overlap (DoD: "two
  organisations on one deployment with no cross-visibility,
  proven by tests").
- `interOrgTransfers.test.ts` — happy path (two ledger rows + fund
  balance updates), sender/receiver consent required, allow-list
  honoured, restricted funds refused, idempotency replay returns
  the same row, non-founder refused.

## Database privileges (§9.4)

`migrations/0002_db_users.ts` creates five least-privilege Mongo roles:

- `sfu_api_role` — read/write on workflow collections; **insert-only** on
  `audit_log`, `approval_events`, `ledger_entries`, `stripe_events`.
- `sfu_public_read_role` — reserved for later public views.
- `sfu_beneficiary_role` — reserved for the private DB module.
- `sfu_worker_role` — can process the outbox and append to insert-only
  collections.
- `sfu_migrate_role` — full control, used only by the migration process.

On managed Atlas, create the equivalents from the Atlas UI with the exact
privileges the migration prints to stdout when it cannot `createRole` itself.

## Restore drill

Mongo Atlas provides continuous backup with point-in-time restore. The
quarterly drill:

1. Clone the latest snapshot into a staging cluster.
2. Point the staging API at the clone (`MONGO_URI`), run `npm run migrate`
   (should be a no-op) and the health probes.
3. Sign in as the staging founder and confirm the audit log and the
   invitation flow still work.
4. File the drill ID into the audit log (`audit.restore_drill`).
