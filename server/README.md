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
# Another for the worker:
npm run dev:worker
```

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
