import mongoose, { Schema } from "mongoose";

// A donation is the donor-facing record. The money movement is in the
// FinancialTransaction. gross_cents = net_cents + fee_cents (all three in
// source currency, with base equivalents captured in base_* fields).
export type DonationStatus =
  | "pending"
  | "succeeded"
  | "refunded"
  | "partially_refunded"
  | "disputed"
  | "failed";

export type DonationDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  public_id: string | null;
  donor_name: string | null;
  donor_email: string | null;
  anonymous: boolean;
  // Project designation chosen at checkout; general-fund if null.
  project_id: mongoose.Types.ObjectId | null;
  fund_id: mongoose.Types.ObjectId;
  // Original currency reported by the processor.
  source_currency: string;
  gross_source_cents: number;
  fee_source_cents: number;
  net_source_cents: number;
  // Base-currency snapshot at capture time; locked for reporting.
  base_currency: string;
  gross_base_cents: number;
  fee_base_cents: number;
  net_base_cents: number;
  fx_rate: number | null;
  // Processor references
  processor: "stripe" | "manual";
  stripe_charge_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_customer_id: string | null;
  recurring: boolean;
  // Set at verify-time by the supporter flow (Phase 7) when the donor_email
  // matches a verified supporter. Donations with no match stay unlinked.
  supporter_user_id: mongoose.Types.ObjectId | null;
  status: DonationStatus;
  // The posted transaction + its reversal if applicable.
  transaction_id: mongoose.Types.ObjectId | null;
  refund_transaction_id: mongoose.Types.ObjectId | null;
  received_at: Date;
  refunded_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

const DonationSchema = new Schema<DonationDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    public_id: { type: String, default: null, maxlength: 32 },
    donor_name: { type: String, default: null, maxlength: 160 },
    donor_email: { type: String, default: null, maxlength: 254 },
    anonymous: { type: Boolean, default: false },
    project_id: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    fund_id: { type: Schema.Types.ObjectId, ref: "Fund", required: true },
    source_currency: { type: String, required: true, maxlength: 3 },
    gross_source_cents: { type: Number, required: true, min: 0 },
    fee_source_cents: { type: Number, required: true, min: 0 },
    net_source_cents: { type: Number, required: true, min: 0 },
    base_currency: { type: String, required: true, maxlength: 3 },
    gross_base_cents: { type: Number, required: true, min: 0 },
    fee_base_cents: { type: Number, required: true, min: 0 },
    net_base_cents: { type: Number, required: true, min: 0 },
    fx_rate: { type: Number, default: null, min: 0 },
    processor: { type: String, enum: ["stripe", "manual"], required: true },
    stripe_charge_id: { type: String, default: null, maxlength: 64 },
    stripe_payment_intent_id: { type: String, default: null, maxlength: 64 },
    stripe_customer_id: { type: String, default: null, maxlength: 64 },
    recurring: { type: Boolean, default: false },
    supporter_user_id: { type: Schema.Types.ObjectId, ref: "User", default: null },
    status: {
      type: String,
      enum: ["pending", "succeeded", "refunded", "partially_refunded", "disputed", "failed"],
      required: true,
      default: "pending",
    },
    transaction_id: { type: Schema.Types.ObjectId, ref: "FinancialTransaction", default: null },
    refund_transaction_id: { type: Schema.Types.ObjectId, ref: "FinancialTransaction", default: null },
    received_at: { type: Date, required: true },
    refunded_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, collection: "donations" }
);

DonationSchema.index(
  { organization_id: 1, public_id: 1 },
  { unique: true, partialFilterExpression: { public_id: { $type: "string" } } }
);
DonationSchema.index({ organization_id: 1, received_at: -1 });
DonationSchema.index({ organization_id: 1, status: 1, received_at: -1 });
DonationSchema.index(
  { organization_id: 1, supporter_user_id: 1, received_at: -1 },
  { partialFilterExpression: { supporter_user_id: { $type: "objectId" } } }
);
DonationSchema.index(
  { stripe_charge_id: 1 },
  { unique: true, partialFilterExpression: { stripe_charge_id: { $type: "string" } } }
);

export const Donation =
  mongoose.models.Donation ?? mongoose.model<DonationDoc>("Donation", DonationSchema);
