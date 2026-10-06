import mongoose, { Schema } from "mongoose";

// A fund partitions money. Default fund is "general"; project-restricted
// donations go into a project-tied fund so expenses can draw from the right
// pool. Project-tied funds carry project_id; general / unrestricted funds
// leave it null.
export type FundKind = "general" | "project" | "restricted" | "endowment";

export type FundRestriction = {
  // Human-readable purpose (shown in the admin UI).
  purpose: string;
  // Account prefixes allowed on expense lines. Empty => all expense_* allowed.
  allowed_expense_prefixes: string[];
  // Projects this fund may spend on. Empty => any (unrestricted project).
  allowed_project_ids: mongoose.Types.ObjectId[];
  // Expiry — after this date the fund can only be transferred to GEN.
  expires_on: Date | null;
};

export type FundDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  code: string; // short lookup key, e.g. "GEN", "P:clean-water"
  name: string;
  kind: FundKind;
  project_id: mongoose.Types.ObjectId | null;
  base_currency: string;
  // Denormalized rolling balance in base-currency cents, maintained by the
  // ledger service inside the post transaction.
  balance_cents: number;
  total_in_cents: number;
  total_out_cents: number;
  // Set only on kind=restricted or kind=endowment; null for general/project.
  restriction: FundRestriction | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
};

const FundSchema = new Schema<FundDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    code: { type: String, required: true, maxlength: 40, uppercase: false },
    name: { type: String, required: true, maxlength: 160 },
    kind: {
      type: String,
      enum: ["general", "project", "restricted", "endowment"],
      required: true,
    },
    project_id: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    base_currency: { type: String, required: true, maxlength: 3 },
    balance_cents: { type: Number, default: 0 },
    total_in_cents: { type: Number, default: 0 },
    total_out_cents: { type: Number, default: 0 },
    restriction: {
      type: new Schema(
        {
          purpose: { type: String, required: true, maxlength: 500 },
          allowed_expense_prefixes: { type: [String], default: [] },
          allowed_project_ids: { type: [Schema.Types.ObjectId], ref: "Project", default: [] },
          expires_on: { type: Date, default: null },
        },
        { _id: false }
      ),
      default: null,
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, collection: "funds" }
);

FundSchema.index({ organization_id: 1, code: 1 }, { unique: true });
FundSchema.index({ organization_id: 1, project_id: 1 }, { sparse: true });

export const Fund = (mongoose.models.Fund as mongoose.Model<FundDoc> | undefined) ?? mongoose.model<FundDoc>("Fund", FundSchema);
