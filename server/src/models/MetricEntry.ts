import mongoose, { Schema } from "mongoose";

// Immutable (append-only) time series of metric observations. Each
// published accomplishment produces one or more entries; direct metric
// backfills by a finance_manager also land here.
export type MetricEntryDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  definition_id: mongoose.Types.ObjectId;
  project_id: mongoose.Types.ObjectId | null;
  accomplishment_id: mongoose.Types.ObjectId | null;
  value: number;
  unit: string | null;
  occurred_on: Date;
  recorded_by: mongoose.Types.ObjectId;
  created_at: Date;
};

const MetricEntrySchema = new Schema<MetricEntryDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    definition_id: { type: Schema.Types.ObjectId, ref: "MetricDefinition", required: true },
    project_id: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    accomplishment_id: { type: Schema.Types.ObjectId, ref: "Accomplishment", default: null },
    value: { type: Number, required: true },
    unit: { type: String, default: null, maxlength: 32 },
    occurred_on: { type: Date, required: true },
    recorded_by: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
    collection: "metric_entries",
  }
);

MetricEntrySchema.index({ organization_id: 1, definition_id: 1, occurred_on: -1 });
MetricEntrySchema.index({ organization_id: 1, project_id: 1, occurred_on: -1 });
MetricEntrySchema.index({ accomplishment_id: 1 });

export const MetricEntry =
  (mongoose.models.MetricEntry as mongoose.Model<MetricEntryDoc> | undefined) ?? mongoose.model<MetricEntryDoc>("MetricEntry", MetricEntrySchema);
