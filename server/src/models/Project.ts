import mongoose, { Schema } from "mongoose";

export type ProjectStatus = "planning" | "active" | "paused" | "completed" | "archived";

export type ProjectDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  community_id: mongoose.Types.ObjectId;
  category_id: mongoose.Types.ObjectId | null;
  name: string;
  slug: string;
  summary: string;
  description: string;
  status: ProjectStatus;
  starts_on: Date | null;
  ends_on: Date | null;
  budget_cents: number | null;
  base_currency: string | null;
  target_beneficiaries: number | null;
  // Denormalized, worker-maintained progress — 0..100 integer.
  progress_pct: number;
  milestone_counts: { total: number; complete: number; in_progress: number };
  // Snapshot of the latest published accomplishment, maintained by the
  // publish txn (§15.3) so public read paths don't scan the activity feed.
  last_published_at: Date | null;
  published_accomplishment_count: number;
  created_by: mongoose.Types.ObjectId | null;
  version: number;
  created_at: Date;
  updated_at: Date;
};

const ProjectSchema = new Schema<ProjectDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    community_id: { type: Schema.Types.ObjectId, required: true, ref: "Community" },
    category_id: { type: Schema.Types.ObjectId, ref: "ProjectCategory", default: null },
    name: { type: String, required: true, maxlength: 200 },
    slug: { type: String, required: true, lowercase: true, maxlength: 120 },
    summary: { type: String, required: true, maxlength: 500 },
    description: { type: String, default: "", maxlength: 10_000 },
    status: {
      type: String,
      enum: ["planning", "active", "paused", "completed", "archived"],
      default: "planning",
    },
    starts_on: { type: Date, default: null },
    ends_on: { type: Date, default: null },
    budget_cents: { type: Number, default: null, min: 0 },
    base_currency: { type: String, default: null, maxlength: 3 },
    target_beneficiaries: { type: Number, default: null, min: 0 },
    progress_pct: { type: Number, default: 0, min: 0, max: 100 },
    milestone_counts: {
      total: { type: Number, default: 0 },
      complete: { type: Number, default: 0 },
      in_progress: { type: Number, default: 0 },
    },
    last_published_at: { type: Date, default: null },
    published_accomplishment_count: { type: Number, default: 0 },
    created_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    version: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, collection: "projects" }
);

ProjectSchema.index({ organization_id: 1, slug: 1 }, { unique: true });
ProjectSchema.index({ organization_id: 1, status: 1, updated_at: -1 });
ProjectSchema.index({ organization_id: 1, community_id: 1 });

export const Project =
  (mongoose.models.Project as mongoose.Model<ProjectDoc> | undefined) ?? mongoose.model<ProjectDoc>("Project", ProjectSchema);
