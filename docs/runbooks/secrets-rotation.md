# Secrets rotation

Every secret has a documented rotation cadence and a procedure.

| Secret | Cadence | Procedure |
| --- | --- | --- |
| `SESSION_SECRET` | 90 days or on compromise | §Session secret |
| `INTERNAL_PROXY_SECRET` | 90 days or on compromise | §Internal proxy secret |
| Stripe webhook secret | 180 days | §Stripe |
| R2 access keys | 180 days | §R2 |
| Cloudflare Stream API token | 180 days | §Stream |
| Mongo app user password | 180 days | §Mongo |
| MFA issuer label | Never (naming only) | — |

## Session secret

Rotating invalidates every active session. Users will be signed out.

1. Mint a new 48-byte random: `openssl rand -base64 48`.
2. Set `SESSION_SECRET` on the API deployment; roll.
3. Users see the sign-in screen on next request; this is expected.
4. Delete all `sessions` rows older than 1 minute to purge the old secret's
   signed cookies at the DB level (defense in depth).

## Internal proxy secret

The front-end `middleware.ts` injects this on every rewrite. If it ever leaks,
anyone can reach the API directly from the public internet.

1. Mint a new 32-byte random.
2. Set it in both the API deployment AND the Next.js deployment as
   `INTERNAL_PROXY_SECRET`.
3. Roll the Next.js app first (now sends the new value), then the API
   (begins accepting it). Overlap period is <5s.
4. Monitor `request.app_error` with `code: forbidden` from the API — a spike
   means the Next.js deploy lagged.

## Stripe

1. In the Stripe dashboard, add a NEW webhook signing secret (not replace).
2. Deploy with both secrets accepted (temporary code change: array of
   candidates). Verify both succeed.
3. Remove the old secret in Stripe.
4. Remove the array fallback and ship the single-secret build.

## R2

1. In Cloudflare, create a NEW R2 access key pair (do not delete the old
   one yet).
2. Deploy with the new keys.
3. Observe uploads and signed-URL fetches for 24h.
4. Delete the old keys in Cloudflare.

## Stream

1. Create a new Stream API token with the same scope.
2. Deploy with it.
3. Delete the old token in Cloudflare.

## Mongo

1. Add a new user with the same roles (`sfu_api_role` or `sfu_worker_role`).
2. Deploy with the new credentials.
3. Delete the old user after 24h.

## On compromise

- Rotate everything above IMMEDIATELY, in parallel if needed.
- Revoke all sessions (`db.sessions.deleteMany({})`).
- Force-reset passwords for all staff accounts (`User.update_many({status:"active"}, {$set:{password_reset_required:true}})`).
- Open an incident per `incident-response.md`.
