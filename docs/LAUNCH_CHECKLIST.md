# MVP launch checklist (§31)

This is the gating checklist for Phase 5 completion. Every box checked
and signed by two people before we switch DNS to production.

## Code

- [ ] CI green on `main` for the launch commit.
- [ ] `npm run typecheck` clean in both `./` and `./server`.
- [ ] `npm --prefix server test` passes end-to-end (incl. state machine,
      ledger, Stripe idempotency, EXIF strip).
- [ ] `npm --prefix server run audit` reports no `high` or `critical`
      production dependencies.
- [ ] `scripts/headers-scan.mjs https://sfuganda.org` → `ok: true`.
- [ ] `scripts/perf-budget.mjs https://sfuganda.org` → every row `ok: true`.
- [ ] `scripts/authz-matrix.mjs` output reviewed and attached to the
      launch ticket; no diff from the signed-off matrix.
- [ ] `/health/status` returns `status: "ok"` from the production API.

## Data

- [ ] `npm --prefix server run migrate` applied cleanly on production.
      Latest `schema_migrations` row is `0005_finance` (or newer).
- [ ] `npm --prefix server run seed` executed; founder user has signed in
      and enrolled MFA.
- [ ] `npm --prefix server run seed:production` executed; project
      categories, expense categories, metric definitions, general fund,
      launch community present.
- [ ] Historical finance import (if any) completed; integrity report ok.
- [ ] Nightly backups scheduled; first backup verified via
      `restore-drill.md`.

## Infrastructure

- [ ] Production environment provisioned (Next.js, API, worker, Mongo,
      R2 buckets, Stream, mail SMTP).
- [ ] DNS A/AAAA records cut to production; TLS cert active and
      auto-renewing.
- [ ] SPF, DKIM, DMARC published for the `MAIL_FROM` domain. `dig TXT`
      answers reviewed.
- [ ] Stripe webhook endpoint registered for both test and live modes.
- [ ] Cloudflare Stream webhook endpoint registered; test upload played
      back on staging.
- [ ] Alerts configured for `/health/status != ok`, outbox lag > 15min,
      integrity report critical, 5xx rate > 1% over 5 min.
- [ ] On-call rotation populated for the next 30 days.
- [ ] Runbooks reviewed by the on-call: incident response, deploy,
      restore drill, stripe webhook, R2, finance integrity.

## Security

- [ ] Internal authz matrix review signed by two founders/directors.
- [ ] External security review scheduled (required before Phase 6 goes
      public; optional for MVP).
- [ ] Session secret, internal proxy secret, Stripe webhook secret, R2
      keys, Stream token, Mongo app password set from the production
      vault; none committed to source control.
- [ ] CSP review: nonce-based script-src works; no `unsafe-inline` for
      scripts; style sources enumerated.
- [ ] Documents bucket serves ONLY via signed URLs; a direct public URL
      returns 403.

## Content

- [ ] Legal review complete: `/privacy`, `/terms`, `/safeguarding`.
- [ ] Copy review across public pages; tone, names, and dates verified.
- [ ] Empty states on `/projects`, `/accomplishments`, `/communities`,
      `/impact`, `/transparency` have been seen in staging.
- [ ] Error pages (`error.tsx`, `not-found.tsx`) render with the correct
      brand and link back to the homepage.

## Accessibility

- [ ] Manual pass per `docs/runbooks/accessibility.md` complete.
- [ ] axe-core via Playwright passes on the public portal.
- [ ] Keyboard-only walkthrough of the donate flow completed.

## Real-device test (Leon)

- [ ] Trial scheduled in the FIRST week of Phase 5.
- [ ] Field member role tested on a mid-tier Android device over a
      throttled 3G profile.
- [ ] `/field` loads under 3s on first visit; subsequent navigations
      under 1s.
- [ ] One accomplishment captured end-to-end, submitted, reviewed,
      approved, published; the public URL is reachable from a Ugandan
      mobile network.

## Launch

- [ ] First real accomplishment published: public id `SFU-2026-0001`.
- [ ] Status page updated: "Sarah's Foundation is live."
- [ ] Launch announcement sent (newsletter + socials).
- [ ] 72h "launch watch" rotation in place; post-launch review scheduled.
