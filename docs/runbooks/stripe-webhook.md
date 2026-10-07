# Stripe webhook

## Registration

- Dashboard → Developers → Webhooks → Add endpoint.
- URL: `https://sfuganda.org/api/v1/webhooks/stripe`.
- Events: `checkout.session.completed`, `charge.succeeded`,
  `payment_intent.succeeded`, `charge.refunded`, `charge.refund.updated`,
  `charge.dispute.created`, `charge.dispute.closed`.
- Keep BOTH test and live endpoints registered; the test one points at
  staging and uses a separate signing secret.

## Signature failures

- Confirm `STRIPE_WEBHOOK_SECRET` matches the endpoint's signing secret.
- Confirm the request body is not being mutated by a proxy. Our app skips
  `express.json()` for `/v1/webhooks/*`; a reverse proxy that normalizes
  JSON would break verification.
- Check the server clock. Our tolerance is 5 minutes of skew.

## Replay a missed event

1. Dashboard → the webhook → Events → pick the failed one → "Resend".
2. Our `stripe_events` row is unique on `(organization_id, stripe_event_id)`,
   so replays are no-ops unless the previous row was `outcome: error` or
   `outcome: pending`.
3. If a replay still fails: fetch the raw event, call `ingestStripeEvent` from
   a one-off script, inspect the stored row's `error_message`.

## Historical backfill

Stripe backfill is single-threaded, idempotent, and safe to re-run.

1. Export the charges in scope (Dashboard → Payments → Export CSV).
2. For each charge, fetch via `GET /v1/charges/{id}` with the balance
   transaction expanded.
3. POST each as a synthetic `charge.succeeded` event to our webhook, with a
   custom signing header computed from `STRIPE_WEBHOOK_SECRET`. This routes
   through the same code path as live events.
4. Confirm the integrity report is `ok: true` after the batch.

Do NOT write directly into `donations` / `financial_transactions` /
`ledger_entries`. The hash chain and double-entry invariants are only
guaranteed when the ingest path runs.

## Disputes

Our handler flips the donation to `disputed`. The reversal is not posted
automatically — a finance_manager reviews on `/admin/finance`, documents
the dispute (upload the chargeback letter as a `financial_document`), and
posts a reversal transaction manually.
