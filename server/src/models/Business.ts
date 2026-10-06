import mongoose, { Schema } from "mongoose";

// =============================================================================
// Business (Phase 8). A revenue-generating activity run by the foundation
// inside a community — poultry, farm plot, carpentry, bakery, etc. Businesses
// are the "self-sustainable" leg of the sustainability tracker: their
// operating revenue over operating expenses in a month is what the public
// sustainability percentage is computed from (§6.F).
//
// The money itself lives in the ledger (ledger_entries tagged with
// business_id); this document is the workflow record — name, status,
// manager, approval state, and coarse community link.
// =============================================================================

export type BusinessKind =
  | "farming"
  | "livestock"
  | "poultry"
  | "crafts"
  | "retail"
  | "services"
  | "other";

export type BusinessStatus = "planned" | "active" | "paused" | "retired";

export type BusinessDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  community_id: mongoose.Types.ObjectId | null;
  slug: string;
  name: string;
  kind: BusinessKind;
  summary: string;
  manager_id: mongoose.Types.ObjectId | null;
  // The fund the business's revenue posts to by default. Expenses are
  // posted against ExpenseCategory rows flagged is_operating (§8).
  fund_id: mongoose.Types.ObjectId | null;
  status: BusinessStatus;
  // Approval workflow — the business is public only after an approver
  // (director or founder) marks it so (§Phase 8 security).
  public_visibility: "internal" | "public";
  approved_at: Date | null;
  approved_by: mongoose.Types.ObjectId | null;
  retired_on: Date | null;
  created_at: Date;
  updated_at: Date;
  version: number;
};

const BusinessSchema = new Schema<BusinessDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    community_id: { type: Schema.Types.ObjectId, ref: "Community", default: null },
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 120 },
    name: { type: String, required: true, maxlength: 160, trim: true },
    kind: {
      type: String,
      enum: ["farming", "livestock", "poultry", "crafts", "retail", "services", "other"],
      required: true,
    },
    summary: { type: String, default: "", maxlength: 2000 },
    manager_id: { type: Schema.Types.ObjectId, ref: "User", default: null },
    fund_id: { type: Schema.Types.ObjectId, ref: "Fund", default: null },
    status: {
      type: String,
      enum: ["planned", "active", "paused", "retired"],
      required: true,
      default: "planned",
    },
    public_visibility: {
      type: String,
      enum: ["internal", "public"],
      required: true,
      default: "internal",
    },
    approved_at: { type: Date, default: null },
    approved_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    retired_on: { type: Date, default: null },
    version: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, collection: "businesses" }
);

BusinessSchema.index({ organization_id: 1, slug: 1 }, { unique: true });
BusinessSchema.index({ organization_id: 1, community_id: 1, status: 1 });

export const Business =
  mongoose.models.Business ?? mongoose.model<BusinessDoc>("Business", BusinessSchema);
