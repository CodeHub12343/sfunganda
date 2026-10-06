import mongoose, { Schema } from "mongoose";

// Nightly integrity reports: hash chain verification + double-entry
// invariant check + fund balance reconciliation against the sum of
// ledger entries. Append-only. Any ok=false entry pages ops.
export type IntegrityReportDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  ran_at: Date;
  ok: boolean;
  entries_checked: number;
  chain_tip_seq: number;
  chain_tip_hash: string;
  // Per-check breakdown.
  checks: {
    hash_chain_ok: boolean;
    hash_chain_first_bad_seq: number | null;
    double_entry_ok: boolean;
    double_entry_bad_transaction_ids: string[];
    fund_balances_ok: boolean;
    fund_balance_mismatches: Array<{
      fund_id: string;
      stored_cents: number;
      computed_cents: number;
    }>;
  };
  notes: string | null;
  created_at: Date;
};

const IntegrityReportSchema = new Schema<IntegrityReportDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    ran_at: { type: Date, required: true },
    ok: { type: Boolean, required: true },
    entries_checked: { type: Number, required: true, min: 0 },
    chain_tip_seq: { type: Number, required: true, min: 0 },
    chain_tip_hash: { type: String, required: true, maxlength: 64 },
    checks: { type: Schema.Types.Mixed, required: true },
    notes: { type: String, default: null, maxlength: 2000 },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
    collection: "integrity_reports",
  }
);

IntegrityReportSchema.index({ organization_id: 1, ran_at: -1 });
IntegrityReportSchema.index({ organization_id: 1, ok: 1, ran_at: -1 });

export const IntegrityReport =
  (mongoose.models.IntegrityReport as mongoose.Model<IntegrityReportDoc> | undefined) ?? mongoose.model<IntegrityReportDoc>("IntegrityReport", IntegrityReportSchema);
