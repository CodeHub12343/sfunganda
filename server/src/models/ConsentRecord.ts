import mongoose, { Schema } from "mongoose";

export type ConsentScope = {
  web: boolean;
  social: boolean;
  print: boolean;
  internal_only: boolean;
  expires_at: Date | null;
};

export type ConsentRecordDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  // Opaque, operator-chosen identifier for the depicted person. The private
  // identity DB (§14) resolves this to a real identity; here we only keep
  // the shown name and the pointer.
  subject_identifier: string;
  subject_display: string;
  scope: ConsentScope;
  minor: boolean;
  guardian_name: string | null;
  guardian_relationship: string | null;
  signed_form_asset_id: mongoose.Types.ObjectId | null;
  note: string | null;
  granted_by: mongoose.Types.ObjectId;
  granted_at: Date;
  revoked_at: Date | null;
  revoked_by: mongoose.Types.ObjectId | null;
  revocation_reason: string | null;
  created_at: Date;
  updated_at: Date;
};

const ScopeSchema = new Schema<ConsentScope>(
  {
    web: { type: Boolean, default: false },
    social: { type: Boolean, default: false },
    print: { type: Boolean, default: false },
    internal_only: { type: Boolean, default: false },
    expires_at: { type: Date, default: null },
  },
  { _id: false }
);

const ConsentRecordSchema = new Schema<ConsentRecordDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    subject_identifier: { type: String, required: true, maxlength: 128 },
    subject_display: { type: String, required: true, maxlength: 200 },
    scope: { type: ScopeSchema, required: true },
    minor: { type: Boolean, default: false },
    guardian_name: { type: String, default: null, maxlength: 200 },
    guardian_relationship: { type: String, default: null, maxlength: 80 },
    signed_form_asset_id: { type: Schema.Types.ObjectId, ref: "MediaAsset", default: null },
    note: { type: String, default: null, maxlength: 2000 },
    granted_by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    granted_at: { type: Date, required: true, default: () => new Date() },
    revoked_at: { type: Date, default: null },
    revoked_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    revocation_reason: { type: String, default: null, maxlength: 500 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, collection: "consent_records" }
);

ConsentRecordSchema.index({ organization_id: 1, subject_identifier: 1, revoked_at: 1 });
ConsentRecordSchema.index({ organization_id: 1, granted_at: -1 });

export const ConsentRecord =
  (mongoose.models.ConsentRecord as mongoose.Model<ConsentRecordDoc> | undefined) ?? mongoose.model<ConsentRecordDoc>("ConsentRecord", ConsentRecordSchema);
