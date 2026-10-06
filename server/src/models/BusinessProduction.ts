import mongoose, { Schema } from "mongoose";

// =============================================================================
// Business production record (Phase 8). A unit of output produced by a
// business — e.g. "60 eggs sold on 2026-03-05 for 180,000 UGX". The gross
// amount posts to the ledger when the record is approved; this document is
// the workflow approval trail. Separation of duties: the submitter must
// not be the approver (§Phase 8 security).
//
// A record NEVER rewrites itself: an approved record is immutable from the
// service layer. Corrections create a reversing production record.
// =============================================================================

export type ProductionState =
  | "draft"
  | "submitted"
  | "approved"
  | "posted"
  | "rejected"
  | "reversed";

export type ProductionUnit =
  | "kg"
  | "g"
  | "l"
  | "ml"
  | "unit"
  | "pack"
  | "dozen"
  | "hour"
  | "other";

export type BusinessProductionDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  business_id: mongoose.Types.ObjectId;
  community_id: mongoose.Types.ObjectId | null;
  // Human caption shown next to the figure.
  caption: string;
  quantity: number;
  unit: ProductionUnit;
  // Source-currency gross receipts for this record. Posted to the ledger
  // in base currency after FX conversion inside the approve transaction.
  source_currency: string;
  gross_source_cents: number;
  gross_base_cents: number;
  fx_rate: number | null;
  occurred_on: Date;
  // Workflow
  state: ProductionState;
  submitted_by: mongoose.Types.ObjectId;
  submitted_at: Date;
  approved_by: mongoose.Types.ObjectId | null;
  approved_at: Date | null;
  posted_at: Date | null;
  rejected_reason: string | null;
  // Idempotency: one submitter cannot create duplicates (§10.2).
  idempotency_key: string | null;
  // When approved, this points at the posted FinancialTransaction.
  transaction_id: mongoose.Types.ObjectId | null;
  reversal_of: mongoose.Types.ObjectId | null;
  created_at: Date;
  updated_at: Date;
  version: number;
};

const BusinessProductionSchema = new Schema<BusinessProductionDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    business_id: { type: Schema.Types.ObjectId, required: true, ref: "Business" },
    community_id: { type: Schema.Types.ObjectId, ref: "Community", default: null },
    caption: { type: String, default: "", maxlength: 500 },
    quantity: { type: Number, required: true, min: 0 },
    unit: {
      type: String,
      enum: ["kg", "g", "l", "ml", "unit", "pack", "dozen", "hour", "other"],
      required: true,
    },
    source_currency: { type: String, required: true, maxlength: 3 },
    gross_source_cents: { type: Number, required: true, min: 0 },
    gross_base_cents: { type: Number, required: true, min: 0 },
    fx_rate: { type: Number, default: null, min: 0 },
    occurred_on: { type: Date, required: true },
    state: {
      type: String,
      enum: ["draft", "submitted", "approved", "posted", "rejected", "reversed"],
      required: true,
      default: "draft",
    },
    submitted_by: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    submitted_at: { type: Date, required: true, default: () => new Date() },
    approved_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approved_at: { type: Date, default: null },
    posted_at: { type: Date, default: null },
    rejected_reason: { type: String, default: null, maxlength: 1000 },
    idempotency_key: { type: String, default: null, maxlength: 120 },
    transaction_id: { type: Schema.Types.ObjectId, ref: "FinancialTransaction", default: null },
    reversal_of: { type: Schema.Types.ObjectId, ref: "BusinessProduction", default: null },
    version: { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "business_production",
  }
);

BusinessProductionSchema.index({ organization_id: 1, business_id: 1, occurred_on: -1 });
BusinessProductionSchema.index({ organization_id: 1, state: 1, submitted_at: -1 });
BusinessProductionSchema.index(
  { submitted_by: 1, idempotency_key: 1 },
  { unique: true, partialFilterExpression: { idempotency_key: { $type: "string" } } }
);

export const BusinessProduction =
  mongoose.models.BusinessProduction ??
  mongoose.model<BusinessProductionDoc>("BusinessProduction", BusinessProductionSchema);
