import mongoose, { Schema } from "mongoose";

export type MetricAggregate = "sum" | "avg" | "max" | "last";

export type MetricDefinitionDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  key: string;
  label: string;
  unit: string;
  description: string;
  aggregate: MetricAggregate;
  public: boolean;
  retired_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

const MetricDefinitionSchema = new Schema<MetricDefinitionDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    key: { type: String, required: true, lowercase: true, maxlength: 40 },
    label: { type: String, required: true, maxlength: 120 },
    unit: { type: String, required: true, maxlength: 32 },
    description: { type: String, default: "", maxlength: 500 },
    aggregate: {
      type: String,
      enum: ["sum", "avg", "max", "last"],
      default: "sum",
    },
    public: { type: Boolean, default: false },
    retired_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "metric_definitions",
  }
);

MetricDefinitionSchema.index({ organization_id: 1, key: 1 }, { unique: true });

export const MetricDefinition =
  mongoose.models.MetricDefinition ??
  mongoose.model<MetricDefinitionDoc>("MetricDefinition", MetricDefinitionSchema);
