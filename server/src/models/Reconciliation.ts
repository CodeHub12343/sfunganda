import mongoose, { Schema } from "mongoose";

// Bank or Stripe reconciliation. One row per statement (period + source);
// stores a list of statement lines each matched to zero or more ledger
// entries. A reconciliation is "signed_off" only when every statement line
// has either a match or an explicit variance note.
export type ReconciliationStatus = "draft" | "in_review" | "signed_off" | "rejected";
export type ReconciliationSource = "stripe" | "bank" | "cash_box";

export type ReconciliationLine = {
  external_ref: string;
  posted_on: Date;
  amount_cents: number;
  currency: string;
  description: string;
  matched_entry_ids: mongoose.Types.ObjectId[];
  variance_note: string | null;
};

export type ReconciliationDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  source: ReconciliationSource;
  account_label: string;
  period_code: string;
  starts_on: Date;
  ends_on: Date;
  base_currency: string;
  opening_balance_cents: number;
  closing_balance_cents: number;
  statement_lines: ReconciliationLine[];
  status: ReconciliationStatus;
  prepared_by: mongoose.Types.ObjectId;
  signed_off_by: mongoose.Types.ObjectId | null;
  signed_off_at: Date | null;
  document_id: mongoose.Types.ObjectId | null;
  variance_cents: number;
  notes: string;
  version: number;
  created_at: Date;
  updated_at: Date;
};

const LineSchema = new Schema<ReconciliationLine>(
  {
    external_ref: { type: String, required: true, maxlength: 128 },
    posted_on: { type: Date, required: true },
    amount_cents: { type: Number, required: true },
    currency: { type: String, required: true, maxlength: 3 },
    description: { type: String, default: "", maxlength: 500 },
    matched_entry_ids: { type: [Schema.Types.ObjectId], default: [], ref: "LedgerEntry" },
    variance_note: { type: String, default: null, maxlength: 500 },
  },
  { _id: false }
);

const ReconciliationSchema = new Schema<ReconciliationDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    source: { type: String, enum: ["stripe", "bank", "cash_box"], required: true },
    account_label: { type: String, required: true, maxlength: 120 },
    period_code: { type: String, required: true, maxlength: 10 },
    starts_on: { type: Date, required: true },
    ends_on: { type: Date, required: true },
    base_currency: { type: String, required: true, maxlength: 3 },
    opening_balance_cents: { type: Number, required: true, default: 0 },
    closing_balance_cents: { type: Number, required: true, default: 0 },
    statement_lines: { type: [LineSchema], default: [] },
    status: {
      type: String,
      enum: ["draft", "in_review", "signed_off", "rejected"],
      required: true,
      default: "draft",
    },
    prepared_by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    signed_off_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    signed_off_at: { type: Date, default: null },
    document_id: { type: Schema.Types.ObjectId, ref: "FinancialDocument", default: null },
    variance_cents: { type: Number, default: 0 },
    notes: { type: String, default: "", maxlength: 2000 },
    version: { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "reconciliations",
  }
);

ReconciliationSchema.index({ organization_id: 1, period_code: 1, source: 1, account_label: 1 }, { unique: true });
ReconciliationSchema.index({ organization_id: 1, status: 1, created_at: -1 });

export const Reconciliation =
  mongoose.models.Reconciliation ??
  mongoose.model<ReconciliationDoc>("Reconciliation", ReconciliationSchema);
