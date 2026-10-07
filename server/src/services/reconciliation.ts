import mongoose from "mongoose";
import { LedgerEntry, Reconciliation } from "@/models/index.js";
import type {
  ReconciliationDoc,
  ReconciliationLine,
  ReconciliationSource,
  ReconciliationStatus,
} from "@/models/Reconciliation.js";
import { AppError } from "@/util/errors.js";
import { can, type Actor } from "@/policy/index.js";

export async function createReconciliation(
  actor: Actor,
  input: {
    source: ReconciliationSource;
    account_label: string;
    period_code: string;
    starts_on: string;
    ends_on: string;
    base_currency: string;
    opening_balance_cents: number;
    closing_balance_cents: number;
    statement_lines: Array<{
      external_ref: string;
      posted_on: string;
      amount_cents: number;
      currency: string;
      description?: string;
    }>;
    notes?: string;
  }
): Promise<ReconciliationDoc> {
  if (!can(actor, "finance.write", { kind: "finance", organization_id: actor.organization_id }))
    throw new AppError("forbidden", "cannot create reconciliation");
  const orgId = new mongoose.Types.ObjectId(actor.organization_id);
  const lines: ReconciliationLine[] = input.statement_lines.map((l) => ({
    external_ref: l.external_ref,
    posted_on: new Date(l.posted_on),
    amount_cents: l.amount_cents,
    currency: l.currency.toUpperCase(),
    description: l.description ?? "",
    matched_entry_ids: [],
    variance_note: null,
  }));
  try {
    const doc = await Reconciliation.create({
      organization_id: orgId,
      source: input.source,
      account_label: input.account_label,
      period_code: input.period_code,
      starts_on: new Date(input.starts_on),
      ends_on: new Date(input.ends_on),
      base_currency: input.base_currency.toUpperCase(),
      opening_balance_cents: input.opening_balance_cents,
      closing_balance_cents: input.closing_balance_cents,
      statement_lines: lines,
      status: "draft",
      prepared_by: new mongoose.Types.ObjectId(actor.user_id),
      notes: input.notes ?? "",
      variance_cents: 0,
    });
    return doc.toObject();
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      throw new AppError("conflict", "a reconciliation for that period/source already exists");
    }
    throw err;
  }
}

export async function matchLine(
  actor: Actor,
  reconciliation_id: string,
  line_index: number,
  patch: {
    matched_entry_ids?: string[];
    variance_note?: string | null;
    version: number;
  }
): Promise<ReconciliationDoc> {
  if (!can(actor, "finance.write", { kind: "finance", organization_id: actor.organization_id }))
    throw new AppError("forbidden", "cannot update reconciliation");
  const orgId = new mongoose.Types.ObjectId(actor.organization_id);
  const rec = await Reconciliation.findOne({
    _id: new mongoose.Types.ObjectId(reconciliation_id),
    organization_id: orgId,
  });
  if (!rec) throw new AppError("not_found", "reconciliation not found");
  if (rec.version !== patch.version)
    throw new AppError("version_conflict", "it has changed since you loaded it");
  if (rec.status === "signed_off") throw new AppError("conflict", "already signed off");
  const line = rec.statement_lines[line_index];
  if (!line) throw new AppError("not_found", "line not found");
  if (patch.matched_entry_ids !== undefined) {
    const ids = patch.matched_entry_ids.map((x) => new mongoose.Types.ObjectId(x));
    // Validate each matched entry exists in this org.
    const count = await LedgerEntry.countDocuments({ _id: { $in: ids }, organization_id: orgId });
    if (count !== ids.length) throw new AppError("not_found", "one or more entries not found");
    line.matched_entry_ids = ids;
  }
  if (patch.variance_note !== undefined) line.variance_note = patch.variance_note;
  rec.variance_cents = computeVariance(rec.statement_lines);
  rec.version += 1;
  await rec.save();
  return rec.toObject();
}

function computeVariance(lines: ReconciliationLine[]): number {
  // Sum of statement amounts minus sum of matched ledger amounts, per line.
  // For MVP we treat an unmatched line as full variance. The admin UI shows
  // the running delta so operators can zero it out before sign-off.
  let variance = 0;
  for (const l of lines) {
    if (l.matched_entry_ids.length === 0) variance += l.amount_cents;
  }
  return variance;
}

export async function setStatus(
  actor: Actor,
  reconciliation_id: string,
  status: ReconciliationStatus,
  version: number
): Promise<ReconciliationDoc> {
  if (!can(actor, "finance.write", { kind: "finance", organization_id: actor.organization_id }))
    throw new AppError("forbidden", "cannot update reconciliation");
  const orgId = new mongoose.Types.ObjectId(actor.organization_id);
  const rec = await Reconciliation.findOne({ _id: reconciliation_id, organization_id: orgId });
  if (!rec) throw new AppError("not_found", "not found");
  if (rec.version !== version)
    throw new AppError("version_conflict", "it has changed since you loaded it");
  if (status === "signed_off") {
    if (rec.prepared_by.toString() === actor.user_id) {
      throw new AppError("forbidden", "the preparer cannot sign off their own reconciliation");
    }
    const hasUnexplained = rec.statement_lines.some(
      (l) => l.matched_entry_ids.length === 0 && !l.variance_note
    );
    if (hasUnexplained) {
      throw new AppError("unprocessable", "every unmatched line needs a variance note before sign-off");
    }
    rec.signed_off_by = new mongoose.Types.ObjectId(actor.user_id);
    rec.signed_off_at = new Date();
  }
  rec.status = status;
  rec.version += 1;
  await rec.save();
  return rec.toObject();
}

export async function listReconciliations(
  actor: Actor,
  opts: { period_code?: string; source?: ReconciliationSource; status?: ReconciliationStatus; limit?: number }
): Promise<ReconciliationDoc[]> {
  if (!can(actor, "finance.read", { kind: "finance", organization_id: actor.organization_id }))
    throw new AppError("forbidden", "cannot list reconciliations");
  const q: Record<string, unknown> = {
    organization_id: new mongoose.Types.ObjectId(actor.organization_id),
  };
  if (opts.period_code) q.period_code = opts.period_code;
  if (opts.source) q.source = opts.source;
  if (opts.status) q.status = opts.status;
  return Reconciliation.find(q)
    .sort({ created_at: -1 })
    .limit(opts.limit ?? 50)
    .lean<ReconciliationDoc[]>();
}
