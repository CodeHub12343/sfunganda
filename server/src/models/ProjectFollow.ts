import mongoose, { Schema } from "mongoose";

// A follow edge from a user to a project. Unique on (user, project).
// Followers receive accomplishment-published notifications per prefs.
export type ProjectFollowDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  project_id: mongoose.Types.ObjectId;
  created_at: Date;
};

const ProjectFollowSchema = new Schema<ProjectFollowDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    user_id: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    project_id: { type: Schema.Types.ObjectId, required: true, ref: "Project" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false }, collection: "project_follows" }
);

ProjectFollowSchema.index({ organization_id: 1, user_id: 1, project_id: 1 }, { unique: true });
ProjectFollowSchema.index({ project_id: 1 });
ProjectFollowSchema.index({ organization_id: 1, user_id: 1 });

export const ProjectFollow =
  (mongoose.models.ProjectFollow as mongoose.Model<ProjectFollowDoc> | undefined) ?? mongoose.model<ProjectFollowDoc>("ProjectFollow", ProjectFollowSchema);
