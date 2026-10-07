import mongoose, { Schema } from "mongoose";

export type MilestoneStatus = "planned" | "in_progress" | "complete" | "cancelled";

export type ProjectMilestoneDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  project_id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  due_on: Date | null;
  status: MilestoneStatus;
  weight: number;
  order: number;
  completed_at: Date | null;
  version: number;
  created_at: Date;
  updated_at: Date;
};

const ProjectMilestoneSchema = new Schema<ProjectMilestoneDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    project_id: { type: Schema.Types.ObjectId, required: true, ref: "Project" },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, default: "", maxlength: 2000 },
    due_on: { type: Date, default: null },
    status: {
      type: String,
      enum: ["planned", "in_progress", "complete", "cancelled"],
      default: "planned",
    },
    weight: { type: Number, default: 1, min: 1, max: 100 },
    order: { type: Number, default: 0 },
    completed_at: { type: Date, default: null },
    version: { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "project_milestones",
  }
);

ProjectMilestoneSchema.index({ organization_id: 1, project_id: 1, order: 1 });
ProjectMilestoneSchema.index({ organization_id: 1, status: 1 });

export const ProjectMilestone =
  (mongoose.models.ProjectMilestone as mongoose.Model<ProjectMilestoneDoc> | undefined) ?? mongoose.model<ProjectMilestoneDoc>("ProjectMilestone", ProjectMilestoneSchema);
