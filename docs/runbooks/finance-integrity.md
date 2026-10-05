# Finance integrity

## Nightly job

- Runs via `npm --prefix server run integrity` from systemd / cron.
- Writes one `IntegrityReport` row per organization.
- Exit code 0 on OK, 2 on any failure.

The dashboard panel reads the latest row via `/health/status` →
`integrity.ok`. A `false` or `null` older than 36h is a SEV-2.

## What the job verifies

1. **Hash chain** — `verifyChain()` walks every `ledger_entries` row in
   `seq` order; expected `prev_hash` and `hash` must match.
2. **Double-entry per transaction** — for every posted transaction, the
   sum of debit amounts equals the sum of credit amounts.
3. **Fund balances** — stored `funds.balance_cents` equals the ledger-
   derived balance (debits minus credits over asset accounts).

## Response — hash chain broken

**STOP posting new finance transactions.** The `finance.write` policy
cannot be relied on while a tamper is suspected.

1. Query the first bad seq from the latest report:
   ```js
   db.integrity_reports.find().sort({ran_at:-1}).limit(1).pretty()
   ```
2. Inspect the offending entry and its neighbors. Compare `hash` against
   the recomputed value with `services/ledger.ts:computeHash`.
3. If the entry was legitimately mutated by an operator (direct DB access),
   that is the incident — reconstruct history from the snapshot predating
   the mutation.
4. If the entry diverged by itself, open a SEV-1 and freeze the DB user with
   write access to `ledger_entries`.

The ledger is append-only via Mongo role (`sfu_api_role` has `insert` only
on `ledger_entries`). Any update MUST have come from a user with the migrate
role or from outside the app — treat it as a compromise until proven otherwise.

## Response — double-entry mismatch

Rare, because the service refuses unbalanced lines at write time.

1. Identify the offending `transaction_id` from the report.
2. Query its ledger rows; look for a missing side (a partial write).
3. If the writer crashed between inserting debit and credit: the
   transaction was NOT inside a Mongo session. Inspect `postToLedger` for
   recent code changes.
4. Correct by posting a balancing adjustment via `/admin/finance/transactions`
   with the compensating line, approved by two separate people.

## Response — fund balance mismatch

The stored `balance_cents` drifted from what the ledger says.

1. Trust the ledger. Recompute: sum of debits minus credits over asset
   accounts for that fund.
2. Patch the stored balance in a single-shot script. Record the delta in
   `IntegrityReport.notes`.
3. Review recent code paths that touch `Fund.updateOne` — the ledger service
   is the only place that should.
