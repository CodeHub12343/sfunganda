import mongoose, { Schema } from "mongoose";

// =============================================================================
// Phase 11 — Public projection of the children's fund (§13.7, §19.3).
//
// This document lives in the MAIN database, not the private one. The
// beneficiary service writes it on every approve/reverse so the public
// endpoint has a safe, pre-suppressed figure to serve WITHOUT touching
// the private DB. The public endpoint is the only route that reads this
// collection; the beneficiary module never reads it back.
//
// Keeping the public projection on the main-DB side is the mechanism
// that preserves "no query path from a public endpoint to the private
// database" (DoD): the public code imports main-DB models only, and the
// private module writes outwards into them.
// =============================================================================

export type BeneficiaryFundSummaryDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  public_fund_id: mongoose.Types.ObjectId;
  // Aggregates "as of" `updated_at`.
  total_in_cents: number;
  total_out_cents: number;
  balance_cents: number;
  // Count of DISTINCT beneficiaries with any approved activity in the fund.
  // k-anonymity suppression is applied at read time, not here — the raw
  // number lives on this row for the admin screen, which also looks at
  // this collection but is role-gated.
  beneficiary_count: number;
  base_currency: string;
  // The last approve/reverse event id so the admin can audit the "fresh"
  // state of the public figure.
  last_event_tx_id: string | null;
  updated_at: Date;
  created_at: Date;
};

const BeneficiaryFundSummarySchema = new Schema<BeneficiaryFundSummaryDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    public_fund_id: { type: Schema.Types.ObjectId, required: true, ref: "Fund" },
    total_in_cents: { type: Number, required: true, default: 0 },
    total_out_cents: { type: Number, required: true, default: 0 },
    balance_cents: { type: Number, required: true, default: 0 },
    beneficiary_count: { type: Number, required: true, default: 0, min: 0 },
    base_currency: { type: String, required: true, maxlength: 3 },
    last_event_tx_id: { type: String, default: null, maxlength: 32 },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "beneficiary_fund_summaries",
  }
);

BeneficiaryFundSummarySchema.index(
  { organization_id: 1, public_fund_id: 1 },
  { unique: true }
);

export const BeneficiaryFundSummary =
  (mongoose.models.BeneficiaryFundSummary as mongoose.Model<BeneficiaryFundSummaryDoc> | undefined) ?? mongoose.model<BeneficiaryFundSummaryDoc>(
    "BeneficiaryFundSummary",
    BeneficiaryFundSummarySchema
  );
