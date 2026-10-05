import mongoose, { Schema } from "mongoose";

// Insert-only, hash-chained double-entry ledger. Each entry carries the
// SHA-256 of (seed || prev_hash || canonical(row)) so any tampering with
// a historical row breaks the chain detectably.
export type LedgerSide = "debit" | "credit";

export type LedgerEntryDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  // Monotonic sequence per organization. Allocated inside the post txn
  // from IdSequence(kind="ledger"). Guarantees total order for the chain.
  seq: number;
  transaction_id: mongoose.Types.ObjectId;
  transaction_public_id: string | null;
  side: LedgerSide;
  fund_id: mongoose.Types.ObjectId;
  account: string;
  amount_cents: number;
  base_currency: string;
  memo: string | null;
  project_id: mongoose.Types.ObjectId | null;
  expense_category_id: mongoose.Types.ObjectId | null;
  posted_at: Date;
  // Hash chain
  prev_hash: string; // hex-encoded sha256 of the preceding entry, or seed hash for seq=1
  hash: string;      // hex-encoded sha256 of (seed || prev_hash || canonical(row))
  created_at: Date;
};

const LedgerEntrySchema = new Schema<LedgerEntryDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    seq: { type: Number, required: true },
    transaction_id: { type: Schema.Types.ObjectId, ref: "FinancialTransaction", required: true },
    transaction_public_id: { type: String, default: null, maxlength: 32 },
    side: { type: String, enum: ["debit", "credit"], required: true },
    fund_id: { type: Schema.Types.ObjectId, ref: "Fund", required: true },
    account: { type: String, required: true, maxlength: 64 },
    amount_cents: { type: Number, required: true, min: 1 },
    base_currency: { type: String, required: true, maxlength: 3 },
    memo: { type: String, default: null, maxlength: 500 },
    project_id: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    expense_category_id: { type: Schema.Types.ObjectId, ref: "ExpenseCategory", default: null },
    posted_at: { type: Date, required: true },
    prev_hash: { type: String, required: true, maxlength: 64 },
    hash: { type: String, required: true, maxlength: 64 },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
    collection: "ledger_entries",
  }
);

LedgerEntrySchema.index({ organization_id: 1, seq: 1 }, { unique: true });
LedgerEntrySchema.index({ transaction_id: 1 });
LedgerEntrySchema.index({ organization_id: 1, account: 1, posted_at: -1 });
LedgerEntrySchema.index({ organization_id: 1, fund_id: 1, posted_at: -1 });
LedgerEntrySchema.index({ project_id: 1, posted_at: -1 }, { sparse: true });
LedgerEntrySchema.index({ hash: 1 }, { unique: true });

export const LedgerEntry =
  mongoose.models.LedgerEntry ?? mongoose.model<LedgerEntryDoc>("LedgerEntry", LedgerEntrySchema);
