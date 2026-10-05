import mongoose, { Schema } from "mongoose";

export type MediaLinkTarget =
  | "community"
  | "project"
  | "accomplishment"
  | "user"
  | "story"
  | "page"
  | "consent_record";

export type MediaLinkDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  asset_id: mongoose.Types.ObjectId;
  target: MediaLinkTarget;
  target_id: mongoose.Types.ObjectId;
  // Semantic role on that target: "hero", "gallery", "evidence", "poster",
  // "signed_form", etc. Free-form so new feature code can introduce roles
  // without a schema change.
  role: string | null;
  order: number;
  created_by: mongoose.Types.ObjectId | null;
  created_at: Date;
};

const MediaLinkSchema = new Schema<MediaLinkDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    asset_id: { type: Schema.Types.ObjectId, required: true, ref: "MediaAsset" },
    target: {
      type: String,
      enum: ["community", "project", "accomplishment", "user", "story", "page", "consent_record"],
      required: true,
    },
    target_id: { type: Schema.Types.ObjectId, required: true },
    role: { type: String, default: null, maxlength: 32 },
    order: { type: Number, default: 0 },
    created_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false }, collection: "media_links" }
);

MediaLinkSchema.index({ organization_id: 1, target: 1, target_id: 1, order: 1 });
MediaLinkSchema.index({ asset_id: 1 });
MediaLinkSchema.index(
  { asset_id: 1, target: 1, target_id: 1, role: 1 },
  { unique: true, partialFilterExpression: { role: { $type: "string" } } }
);

export const MediaLink =
  mongoose.models.MediaLink ?? mongoose.model<MediaLinkDoc>("MediaLink", MediaLinkSchema);
