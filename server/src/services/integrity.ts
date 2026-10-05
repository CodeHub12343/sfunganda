import mongoose from "mongoose";
import {
  Fund,
  IntegrityReport,
  LedgerEntry,
  Organization,
} from "@/models/index.js";
import { verifyChain } from "./ledger.js";
import { log } from "@/util/log.js";

export async function runIntegrity(
  organization_id?: mongoose.Types.ObjectId
): Promise<{ ok: boolean; reports: Array<{ organization_id: string; ok: boolean }> }> {
  const orgs = organization_id
    ? [{ _id: organization_id }]
    : await Organization.find().select({ _id: 1 }).lean();

  const reports: Array<{ organization_id: string; ok: boolean }> = [];
  for (const org of orgs) {
    const orgId = org._id as mongoose.Types.ObjectId;

    const chain = await verifyChain(orgId);

    // Per-transaction double-entry invariant: sum of debits == sum of credits
    // for every posted transaction's ledger rows.
    const bad: string[] = [];
    const txIds = await LedgerEntry.distinct("transaction_id", { organization_id: orgId });
    for (const txId of txIds) {
      const sums = await LedgerEntry.aggregate([
        { $match: { organization_id: orgId, transaction_id: txId } },
        { $group: { _id: "$side", total: { $sum: "$amount_cents" } } },
      ]);
      let debit = 0;
      let credit = 0;
      for (const r of sums) {
        if (r._id === "debit") debit = Number(r.total ?? 0);
        if (r._id === "credit") credit = Number(r.total ?? 0);
      }
      if (debit !== credit) bad.push(String(txId));
    }

    // Fund balance: stored balance_cents must equal sum of asset-account
    // deltas over the ledger per fund.
    const funds = await Fund.find({ organization_id: orgId }).lean();
    const mismatches: Array<{ fund_id: string; stored_cents: number; computed_cents: number }> = [];
    for (const f of funds) {
      const rows = await LedgerEntry.aggregate([
        {
          $match: {
            organization_id: orgId,
            fund_id: f._id,
            $or: [
              { account: "cash" },
              { account: "stripe_clearing" },
              { account: { $regex: "^bank_" } },
            ],
          },
        },
        {
          $group: {
            _id: "$side",
            total: { $sum: "$amount_cents" },
          },
        },
      ]);
      let d = 0;
      let c = 0;
      for (const r of rows) {
        if (r._id === "debit") d = Number(r.total ?? 0);
        if (r._id === "credit") c = Number(r.total ?? 0);
      }
      const computed = d - c;
      if (computed !== f.balance_cents) {
        mismatches.push({
          fund_id: f._id.toString(),
          stored_cents: f.balance_cents,
          computed_cents: computed,
        });
      }
    }

    const ok = chain.ok && bad.length === 0 && mismatches.length === 0;
    await IntegrityReport.create({
      organization_id: orgId,
      ran_at: new Date(),
      ok,
      entries_checked: chain.last_seq,
      chain_tip_seq: chain.last_seq,
      chain_tip_hash: chain.tip_hash,
      checks: {
        hash_chain_ok: chain.ok,
        hash_chain_first_bad_seq: chain.first_bad_seq,
        double_entry_ok: bad.length === 0,
        double_entry_bad_transaction_ids: bad,
        fund_balances_ok: mismatches.length === 0,
        fund_balance_mismatches: mismatches,
      },
      notes: null,
    });
    if (!ok) {
      log.error(
        {
          orgId: orgId.toString(),
          chain_ok: chain.ok,
          bad_tx_count: bad.length,
          fund_mismatches: mismatches.length,
        },
        "integrity.failed"
      );
    }
    reports.push({ organization_id: orgId.toString(), ok });
  }
  return { ok: reports.every((r) => r.ok), reports };
}

