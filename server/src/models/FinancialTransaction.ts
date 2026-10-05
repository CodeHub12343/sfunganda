import mongoose, { Schema } from "mongoose";

// A financial_transaction is the mutable workflow envelope: draft, submitted,
// approved, posted, reversed. The IMMUTABLE record of money is the
// ledger_entries collection; a transaction carries the lines (double-entry)
// that will become ledger entries when posted.
export type TransactionKind = "donation" | "expense" | "grant" | "refund" | "adjustment" | "transfer";
export type TransactionState = "draft" | "submitted" | "approved" | "posted" | "reversed" | "void";
export type LineSide = "debit" | "credit";

export type TransactionLine = {
  side: LineSide;
  fund_id: mongoose.Types.ObjectId;
  // Human-readable account slug (e.g. "cash", "stripe_clearing", "fees",
  // "revenue_donations", "expense_<category>"). The ledger service uses
  // this to render the trial balance.
  account: string;
  // Amount in the organization's base currency, in cents. Each line is
  // positive; the side determines its sign.
  amount_cents: number;
  memo: string | null;
  // Optional link back to a project or expense category for reports.
  project_id: mongoose.Types.ObjectId | null;
  expense_category_id: mongoose.Types.ObjectId | null;
};

export type FinancialTransactionDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  public_id: string | null; // allocated at post time
  kind: TransactionKind;
  state: TransactionState;
  // Original source and currency as reported upstream (Stripe, UGX
  // expense receipt). base_* fields are what the ledger uses.
  source_currency: string;
  source_amount_cents: number;
  base_currency: string;
  base_amount_cents: number;
  fx_rate: number | null; // base per source; null when they match
  occurred_on: Date;
  memo: string;
  lines: TransactionLine[];

  // Workflow / separation of duties
  created_by: mongoose.Types.ObjectId;
  submitted_by: mongoose.Types.ObjectId | null;
  submitted_at: Date | null;
  approved_by: mongoose.Types.ObjectId | null;
  approved_at: Date | null;
  secondary_approved_by: mongoose.Types.ObjectId | null;
  secondary_approved_at: Date | null;
  period_code: string | null;
  posted_by: mongoose.Types.ObjectId | null;
  posted_at: Date | null;
  reversed_by: mongoose.Types.ObjectId | null;
  reversed_at: Date | null;
  reversal_of: mongoose.Types.ObjectId | null;

  // External provenance
  stripe_charge_id: string | null;
  stripe_payment_intent_id: string | null;
  donation_id: mongoose.Types.ObjectId | null;

  // Document attachments (receipts, invoices).
  document_ids: mongoose.Types.ObjectId[];

  version: number;
  created_at: Date;
  updated_at: Date;
};

const LineSchema = new Schema<TransactionLine>(
  {
    side: { type: String, enum: ["debit", "credit"], required: true },
    fund_id: { type: Schema.Types.ObjectId, ref: "Fund", required: true },
    account: { type: String, required: true, maxlength: 64 },
    amount_cents: { type: Number, required: true, min: 1 },
    memo: { type: String, default: null, maxlength: 500 },
    project_id: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    expense_category_id: { type: Schema.Types.ObjectId, ref: "ExpenseCategory", default: null },
  },
  { _id: false }
);

const FinancialTransactionSchema = new Schema<FinancialTransactionDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    public_id: { type: String, default: null, maxlength: 32 },
    kind: {
      type: String,
      enum: ["donation", "expense", "grant", "refund", "adjustment", "transfer"],
      required: true,
    },
    state: {
      type: String,
      enum: ["draft", "submitted", "approved", "posted", "reversed", "void"],
      required: true,
      default: "draft",
    },
    source_currency: { type: String, required: true, maxlength: 3 },
    source_amount_cents: { type: Number, required: true, min: 0 },
    base_currency: { type: String, required: true, maxlength: 3 },
    base_amount_cents: { type: Number, required: true, min: 0 },
    fx_rate: { type: Number, default: null, min: 0 },
    occurred_on: { type: Date, required: true },
    memo: { type: String, default: "", maxlength: 2000 },
    lines: { type: [LineSchema], required: true, default: [] },

    created_by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    submitted_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    submitted_at: { type: Date, default: null },
    approved_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approved_at: { type: Date, default: null },
    secondary_approved_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    secondary_approved_at: { type: Date, default: null },
    period_code: { type: String, default: null, maxlength: 10 },
    posted_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    posted_at: { type: Date, default: null },
    reversed_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reversed_at: { type: Date, default: null },
    reversal_of: { type: Schema.Types.ObjectId, ref: "FinancialTransaction", default: null },

    stripe_charge_id: { type: String, default: null, maxlength: 64 },
    stripe_payment_intent_id: { type: String, default: null, maxlength: 64 },
    donation_id: { type: Schema.Types.ObjectId, ref: "Donation", default: null },

    document_ids: { type: [Schema.Types.ObjectId], default: [], ref: "FinancialDocument" },

    version: { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "financial_transactions",
  }
);

FinancialTransactionSchema.index(
  { organization_id: 1, public_id: 1 },
  { unique: true, partialFilterExpression: { public_id: { $type: "string" } } }
);
FinancialTransactionSchema.index({ organization_id: 1, state: 1, created_at: -1 });
FinancialTransactionSchema.index({ organization_id: 1, kind: 1, posted_at: -1 });
FinancialTransactionSchema.index(
  { stripe_charge_id: 1 },
  { unique: true, partialFilterExpression: { stripe_charge_id: { $type: "string" } } }
);
FinancialTransactionSchema.index(
  { stripe_payment_intent_id: 1 },
  { unique: true, partialFilterExpression: { stripe_payment_intent_id: { $type: "string" } } }
);

export const FinancialTransaction =
  mongoose.models.FinancialTransaction ??
  mongoose.model<FinancialTransactionDoc>("FinancialTransaction", FinancialTransactionSchema);
