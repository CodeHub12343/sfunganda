# Incident response

1. **Acknowledge** the page in PagerDuty.
2. **Open the incident channel.** Create `#inc-<yyyymmdd>-<short-slug>` in Slack and pin
   this runbook.
3. **Appoint roles**: incident commander (IC), scribe, comms. One person can
   hold two roles on a small team; the IC never holds the scribe role.
4. **Status page.** Post the first update within 15 minutes of ack:
   > "We're investigating reports of <symptom>. Updates every 30 minutes."
5. **Diagnose.** Walk the checklist below in order. Stop as soon as you have
   a confident root cause.
6. **Mitigate** before fixing. Shed load, flip a feature flag, scale up — buy
   time first.
7. **Resolve.** Close the status page incident. Record the end-time in the
   channel.
8. **Post-mortem** within 5 business days (SEV-1/2). Blameless; name systems,
   not people.

## Diagnostic checklist

- [ ] `GET /health/live` on the API — process alive?
- [ ] `GET /health/ready` — DB connected, migrations applied?
- [ ] `GET /health/status` — outbox lag, oldest `in_review`, integrity ok?
- [ ] API error-rate dashboard — spike in `request.internal_error`?
- [ ] Next.js dashboard — spike in 5xx, long TTFB?
- [ ] Mongo Atlas / self-hosted replica set — primary stepped down? Disk?
- [ ] Cloudflare R2 — object storage up? Signed URLs 403?
- [ ] Cloudflare Stream — webhooks delivered? Playback 404?
- [ ] Stripe dashboard — webhook retries? Charges succeeding?
- [ ] Deploys — did a release in the last 30 min correlate? Check `git log`.

## Common mitigations

| Symptom | Mitigation |
| --- | --- |
| API returning 500s broadly | Roll back the last Cloud Run / container revision |
| Review queue stuck | Scale the worker; check outbox for a poison event |
| Donations not posting | Pause webhook ingest, replay from the Stripe dashboard |
| Media uploads failing | Confirm R2 keys; fall back to a 503 on `/field` with a notice |
| Integrity report critical | STOP posting new finance transactions. Open `finance-integrity.md`. |

## When data is at risk

- Freeze writes to the affected collection (comment out the mutating service
  entry points, redeploy).
- Snapshot the database (`mongodump` to the restore bucket, tagged with the
  incident id).
- Do not run `mongorestore` without a second person on the call. See
  `restore-drill.md`.
