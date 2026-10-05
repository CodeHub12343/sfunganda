# Restore drill

The database can be restored from a nightly snapshot. The MVP checklist
(§31) requires the first restore drill to pass before launch, and the drill
runs monthly thereafter. If the latest drill is older than 45 days, treat
the restore pipeline as untested.

## Preconditions

- The restore target is **staging**, never production. If production needs
  a restore, declare SEV-1 and page the on-call lead.
- Two people on the call: a driver and a reviewer. The reviewer runs the
  `verify` steps.
- Snapshot source: the `sfu-backups` R2 bucket, prefix `mongo/<yyyy-mm-dd>/`.

## Steps

1. **Pick a snapshot.** Choose the most recent nightly whose integrity
   report was `ok: true`. Record the snapshot id in the incident channel.
2. **Spin up the restore target.** `terraform -chdir=ops/restore apply`.
   This provisions an isolated Mongo instance with no public ingress.
3. **Download + unarchive.** `aws s3 cp ... && tar -xzf snapshot.tar.gz`.
4. **Restore.** `mongorestore --uri "$RESTORE_URI" --drop ./dump`.
   `--drop` is intentional on the staging target.
5. **Rehash.** `npm --prefix server run migrate` to reapply any migrations
   newer than the snapshot.
6. **Verify integrity.** `npm --prefix server run integrity`. Exit code
   must be 0; the latest `IntegrityReport` row must have `ok: true`.
7. **Verify counts.** Compare `db.<col>.estimatedDocumentCount()` against
   the snapshot manifest for `users`, `donations`, `financial_transactions`,
   `ledger_entries`, `accomplishments`. Record any diff.
8. **Verify money.** Sum `ledger_entries.amount_cents` grouped by side; the
   two totals must be equal. The nightly job already asserts this, but we
   re-run after restore because post-snapshot writes replay.
9. **Smoke test.** Hit the staging admin as a founder, open `/admin/finance`,
   and confirm a known transaction renders with its hash chain intact.
10. **Tear down** the restore target. Keep the dump on the drill laptop for
    30 days.

## Pass criteria

The drill passes when, within **90 minutes end-to-end**:

- Every verify step above returns the expected result.
- The newest `IntegrityReport.ok === true`.
- No manual data patching was required to make the service start.

Record the pass/fail in `docs/runbooks/_log.md`.
