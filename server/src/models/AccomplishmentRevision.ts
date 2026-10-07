import mongoose, { Schema } from "mongoose";

// Append-only snapshot taken at each state transition. Lets the review
// screen show diffs and preserves an audit trail of what was shown to the
// reviewer when they approved.
export type AccomplishmentRevisionDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  accomplishment_id: mongoose.Types.ObjectId;
  version: number;
  state_before: string;
  state_after: string;
  snapshot: {
    title: string;
    summary: string;
    body_markdown: string;
    occurred_on: Date;
    beneficiary_count: number | null;
    location_label: string | null;
    media_asset_ids: string[];
    metrics: Array<{ definition_id: string; value: number; unit: string | null }>;
  };
  by_user_id: mongoose.Types.ObjectId;
  note: string | null;
  created_at: Date;
};

const AccomplishmentRevisionSchema = new Schema<AccomplishmentRevisionDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    accomplishment_id: { type: Schema.Types.ObjectId, required: true, ref: "Accomplishment" },
    version: { type: Number, required: true },
    state_before: { type: String, required: true, maxlength: 40 },
    state_after: { type: String, required: true, maxlength: 40 },
    snapshot: { type: Schema.Types.Mixed, required: true },
    by_user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    note: { type: String, default: null, maxlength: 2000 },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
    collection: "accomplishment_revisions",
  }
);

AccomplishmentRevisionSchema.index({ accomplishment_id: 1, version: -1 });
AccomplishmentRevisionSchema.index({ organization_id: 1, created_at: -1 });

export const AccomplishmentRevision =
  (mongoose.models.AccomplishmentRevision as mongoose.Model<AccomplishmentRevisionDoc> | undefined) ?? mongoose.model<AccomplishmentRevisionDoc>("AccomplishmentRevision", AccomplishmentRevisionSchema);
