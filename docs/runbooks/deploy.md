# Deploy

## Pre-deploy checklist

- [ ] CI green on `main`.
- [ ] No pending migrations beyond the one(s) in this release.
- [ ] Secrets rotated if the release touches session / Stripe / R2 / Mongo.
- [ ] CHANGELOG updated with the release notes operators need to read.
- [ ] On-call for the next 24h is aware a release is going out.

## Deploy order

1. **Database migration first.** `npm --prefix server run migrate`. This is
   idempotent. If it changes `schema_migrations`, the deploy is committed to
   the new API before anyone sees it.
2. **API** (Express + worker). Rolling update. `GET /health/ready` returns 200
   before traffic flips. The worker rolls after the API because it imports the
   same schemas.
3. **Next.js app.** Last. Reads from the new API; a brief UI/API skew window
   is acceptable because the API is additive.

## Post-deploy smoke

Hit these from the ops laptop before closing the deploy ticket.

- [ ] `scripts/headers-scan.mjs https://sfuganda.org` → `ok: true`.
- [ ] `scripts/perf-budget.mjs https://sfuganda.org` → every row `ok: true`.
- [ ] `GET /health/status` → `status: "ok"`, outbox pending < 100.
- [ ] Visit `/transparency` and `/accomplishments` as a logged-out user.
- [ ] Visit `/admin/queue` as a director; the sidebar renders.
- [ ] If finance changed: submit a 1 USD donation in Stripe test mode and
      confirm it appears on `/transparency` within 60s.

## Rollback

- Previous container revisions are retained for 7 days. Click "roll back" in
  the deploy UI; it serves the previous image within 30s.
- If the migration is forward-only (adding a validator or index): roll back
  the API only, leave the migration applied.
- If the migration dropped a field: do NOT roll back. Open an incident, fix
  forward.

## Deploy windows

- Weekdays, 10:00–15:00 Africa/Kampala.
- No deploys the hour before a scheduled Stripe payout, the day of a
  campaign send, or on Fridays after 12:00 unless hotfixing.
