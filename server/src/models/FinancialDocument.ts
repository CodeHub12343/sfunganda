import mongoose, { Schema } from "mongoose";

// A receipt, invoice, bank statement, or grant letter. Stored in the
// private documents bucket (Phase 2), never on the public derivatives
// CDN. One document may back several transactions (e.g. a bank statement
// backing a batch of reconciled rows).
export type FinancialDocumentKind =
  | "receipt"
  | "invoice"
  | "bank_statement"
  | "grant_letter"
  | "contract"
  | "other";

export type FinancialDocumentDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  kind: FinancialDocumentKind;
  // The MediaAsset holding the actual file (uploaded via Phase 2 to the
  // documents bucket). Access is signed-URL only.
  media_asset_id: mongoose.Types.ObjectId;
  label: string;
  issuer: string | null;
  issued_on: Date | null;
  reference_no: string | null;
  // Transactions this document supports.
  transaction_ids: mongoose.Types.ObjectId[];
  uploaded_by: mongoose.Types.ObjectId;
  created_at: Date;
  updated_at: Date;
};

const FinancialDocumentSchema = new Schema<FinancialDocumentDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    kind: {
      type: String,
      enum: ["receipt", "invoice", "bank_statement", "grant_letter", "contract", "other"],
      required: true,
    },
    media_asset_id: { type: Schema.Types.ObjectId, ref: "MediaAsset", required: true },
    label: { type: String, required: true, maxlength: 200 },
    issuer: { type: String, default: null, maxlength: 160 },
    issued_on: { type: Date, default: null },
    reference_no: { type: String, default: null, maxlength: 80 },
    transaction_ids: { type: [Schema.Types.ObjectId], default: [], ref: "FinancialTransaction" },
    uploaded_by: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "financial_documents",
  }
);

FinancialDocumentSchema.index({ organization_id: 1, created_at: -1 });
FinancialDocumentSchema.index({ transaction_ids: 1 });

export const FinancialDocument =
  (mongoose.models.FinancialDocument as mongoose.Model<FinancialDocumentDoc> | undefined) ?? mongoose.model<FinancialDocumentDoc>("FinancialDocument", FinancialDocumentSchema);
