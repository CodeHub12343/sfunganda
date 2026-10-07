import mongoose, { Schema } from "mongoose";

// =============================================================================
// Machine translation of a reviewed English summary into a visitor's
// language, cached per (video, language) and tied to the English source by
// `source_hash`. If the English summary changes, a new row is created the
// next time anyone requests that language — the old row is left in place
// until the TTL burns it off, so an in-flight viewer isn't broken mid-page.
// =============================================================================

export type VideoTranslationDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  media_asset_id: mongoose.Types.ObjectId;
  language: string; // BCP-47
  state: "pending" | "ready" | "failed";
  source_hash: string; // hash of the English summary this was translated from
  text: string;
  provider: string;
  model: string | null;
  error: string | null;
  created_at: Date;
  updated_at: Date;
};

const VideoTranslationSchema = new Schema<VideoTranslationDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    media_asset_id: { type: Schema.Types.ObjectId, required: true, ref: "MediaAsset" },
    language: { type: String, required: true, maxlength: 10 },
    state: { type: String, enum: ["pending", "ready", "failed"], required: true, default: "pending" },
    source_hash: { type: String, required: true, maxlength: 64 },
    text: { type: String, default: "", maxlength: 4000 },
    provider: { type: String, required: true, default: "mock", maxlength: 60 },
    model: { type: String, default: null, maxlength: 120 },
    error: { type: String, default: null, maxlength: 500 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, collection: "video_translations" }
);

VideoTranslationSchema.index(
  { organization_id: 1, media_asset_id: 1, language: 1 },
  { unique: true }
);
VideoTranslationSchema.index({ state: 1, created_at: 1 });

export const VideoTranslation =
  (mongoose.models.VideoTranslation as mongoose.Model<VideoTranslationDoc> | undefined) ?? mongoose.model<VideoTranslationDoc>("VideoTranslation", VideoTranslationSchema);
