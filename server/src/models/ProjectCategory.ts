import mongoose, { Schema } from "mongoose";

export type ProjectCategoryDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  color: string | null;
  description: string;
  created_at: Date;
  updated_at: Date;
};

const ProjectCategorySchema = new Schema<ProjectCategoryDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    name: { type: String, required: true, maxlength: 120 },
    slug: { type: String, required: true, lowercase: true, maxlength: 120 },
    color: { type: String, default: null, maxlength: 7 },
    description: { type: String, default: "", maxlength: 1000 },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "project_categories",
  }
);

ProjectCategorySchema.index({ organization_id: 1, slug: 1 }, { unique: true });

export const ProjectCategory =
  mongoose.models.ProjectCategory ??
  mongoose.model<ProjectCategoryDoc>("ProjectCategory", ProjectCategorySchema);
