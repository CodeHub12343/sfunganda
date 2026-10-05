# Runbooks

Operational procedures for the on-call. Every runbook assumes the responder
has:

- Access to the production and staging dashboards.
- The `ops-admin` role in GitHub.
- A hardware MFA token enrolled for the ops Google account.
- The current PagerDuty rotation.

| Runbook | When to use |
| --- | --- |
| [`incident-response.md`](./incident-response.md) | Any user-visible outage or data concern. Start here. |
| [`deploy.md`](./deploy.md) | Rolling a release. Checklists + rollback. |
| [`restore-drill.md`](./restore-drill.md) | Monthly database restore test. Required for MVP sign-off. |
| [`secrets-rotation.md`](./secrets-rotation.md) | Routine or forced rotation (Stripe, R2, Mongo, session). |
| [`stripe-webhook.md`](./stripe-webhook.md) | Signature failures, replays, backfill from the Stripe dashboard. |
| [`r2-bucket.md`](./r2-bucket.md) | Media upload failures, lifecycle rules, scanner connectivity. |
| [`finance-integrity.md`](./finance-integrity.md) | Nightly integrity alert, hash chain or fund mismatch. |
| [`accessibility.md`](./accessibility.md) | Manual pre-launch and ongoing checks. |

## Severity and response times

| Severity | Example | Ack | Comms | Post-mortem |
| --- | --- | --- | --- | --- |
| SEV-1 | Donations down, data loss, integrity report critical | 10 min | Status page updated every 30 min | Yes, within 5 business days |
| SEV-2 | Admin shell broken, review queue stuck, media pipeline paused | 30 min | Internal update | Yes if user-impacting |
| SEV-3 | Public page errors, non-blocking background jobs failing | 2 h | Daily digest | No, ticket only |

If you aren't sure, declare one level higher. Over-declaring costs less than
missing an incident.
