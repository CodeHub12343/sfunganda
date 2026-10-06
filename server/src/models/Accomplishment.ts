import mongoose, { Schema } from "mongoose";

export type AccomplishmentState =
  | "draft"
  | "submitted"
  | "in_review"
  | "changes_requested"
  | "approved"
  | "published"
  | "rejected"
  | "archived";

export type AccomplishmentMetricEntry = {
  definition_id: mongoose.Types.ObjectId;
  value: number;
  unit: string | null;
};

export type AccomplishmentDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  public_id: string | null; // allocated at publish time
  project_id: mongoose.Types.ObjectId;
  milestone_id: mongoose.Types.ObjectId | null;
  state: AccomplishmentState;
  title: string;
  summary: string;
  body_markdown: string;
  occurred_on: Date;
  beneficiary_count: number | null;
  location_label: string | null;
  media_asset_ids: mongoose.Types.ObjectId[];
  metrics: AccomplishmentMetricEntry[];

  // Separation of duties fields.
  created_by: mongoose.Types.ObjectId;
  submitted_by: mongoose.Types.ObjectId | null;
  submitted_at: Date | null;
  reviewer_id: mongoose.Types.ObjectId | null;
  review_started_at: Date | null;
  approved_by: mongoose.Types.ObjectId | null;
  approved_at: Date | null;
  published_by: mongoose.Types.ObjectId | null;
  published_at: Date | null;
  rejected_at: Date | null;

  // Phase 10 — AI assist. `ai_assisted` is set whenever a generation was
  // accepted (fully or partially) into the draft. Publishing an ai_assisted
  // item requires an attestation from the approver (§17.2 step 6).
  ai_assisted: boolean;
  ai_generation_ids: mongoose.Types.ObjectId[];
  ai_attestation_by: mongoose.Types.ObjectId | null;
  ai_attestation_at: Date | null;

  version: number;
  created_at: Date;
  updated_at: Date;
};

const MetricEntrySchema = new Schema<AccomplishmentMetricEntry>(
  {
    definition_id: { type: Schema.Types.ObjectId, ref: "MetricDefinition", required: true },
    value: { type: Number, required: true },
    unit: { type: String, default: null, maxlength: 32 },
  },
  { _id: false }
);

const AccomplishmentSchema = new Schema<AccomplishmentDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    public_id: { type: String, default: null, maxlength: 32 },
    project_id: { type: Schema.Types.ObjectId, required: true, ref: "Project" },
    milestone_id: { type: Schema.Types.ObjectId, ref: "ProjectMilestone", default: null },
    state: {
      type: String,
      enum: [
        "draft",
        "submitted",
        "in_review",
        "changes_requested",
        "approved",
        "published",
        "rejected",
        "archived",
      ],
      required: true,
      default: "draft",
    },
    title: { type: String, required: true, maxlength: 200 },
    summary: { type: String, required: true, maxlength: 500 },
    body_markdown: { type: String, required: true, maxlength: 20_000 },
    occurred_on: { type: Date, required: true },
    beneficiary_count: { type: Number, default: null, min: 0 },
    location_label: { type: String, default: null, maxlength: 160 },
    media_asset_ids: { type: [Schema.Types.ObjectId], default: [], ref: "MediaAsset" },
    metrics: { type: [MetricEntrySchema], default: [] },

    created_by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    submitted_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    submitted_at: { type: Date, default: null },
    reviewer_id: { type: Schema.Types.ObjectId, ref: "User", default: null },
    review_started_at: { type: Date, default: null },
    approved_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approved_at: { type: Date, default: null },
    published_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    published_at: { type: Date, default: null },
    rejected_at: { type: Date, default: null },

    ai_assisted: { type: Boolean, default: false },
    ai_generation_ids: { type: [Schema.Types.ObjectId], ref: "AiGeneration", default: [] },
    ai_attestation_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    ai_attestation_at: { type: Date, default: null },

    version: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, collection: "accomplishments" }
);

AccomplishmentSchema.index(
  { organization_id: 1, public_id: 1 },
  { unique: true, partialFilterExpression: { public_id: { $type: "string" } } }
);
AccomplishmentSchema.index({ organization_id: 1, state: 1, updated_at: -1 });
AccomplishmentSchema.index({ organization_id: 1, project_id: 1, state: 1 });
AccomplishmentSchema.index({ organization_id: 1, published_at: -1 }, { sparse: true });

export const Accomplishment =
  mongoose.models.Accomplishment ??
  mongoose.model<AccomplishmentDoc>("Accomplishment", AccomplishmentSchema);
