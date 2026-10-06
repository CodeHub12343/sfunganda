import mongoose, { Schema } from "mongoose";

// =============================================================================
// Video caption / transcript (R-D step 1). One row per language per video.
// `text` is the full transcript; `cues` is the optional timecoded form used
// to render captions in the player.
// =============================================================================

export type VideoCaptionCue = {
  start_ms: number;
  end_ms: number;
  text: string;
};

export type VideoCaptionDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  media_asset_id: mongoose.Types.ObjectId;
  language: string; // BCP-47; "en" for the source
  state: "pending" | "ready" | "failed";
  provider: string;
  provider_asset_id: string | null;
  text: string;
  cues: VideoCaptionCue[];
  // Short English summary, reviewed by staff. This is the ONLY string that
  // feeds machine translation (§17 / R-D).
  reviewed_summary: string;
  reviewed_summary_by: mongoose.Types.ObjectId | null;
  reviewed_summary_at: Date | null;
  // Hash of (text, reviewed_summary). Translations keyed off this so a reset
  // invalidates cached translations.
  source_hash: string | null;
  error: string | null;
  created_at: Date;
  updated_at: Date;
};

const VideoCaptionSchema = new Schema<VideoCaptionDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    media_asset_id: { type: Schema.Types.ObjectId, required: true, ref: "MediaAsset" },
    language: { type: String, required: true, maxlength: 10 },
    state: { type: String, enum: ["pending", "ready", "failed"], required: true, default: "pending" },
    provider: { type: String, required: true, maxlength: 60, default: "stream" },
    provider_asset_id: { type: String, default: null, maxlength: 120 },
    text: { type: String, default: "", maxlength: 100_000 },
    cues: {
      type: [
        new Schema<VideoCaptionCue>(
          {
            start_ms: { type: Number, required: true, min: 0 },
            end_ms: { type: Number, required: true, min: 0 },
            text: { type: String, required: true, maxlength: 500 },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    reviewed_summary: { type: String, default: "", maxlength: 2000 },
    reviewed_summary_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewed_summary_at: { type: Date, default: null },
    source_hash: { type: String, default: null, maxlength: 64 },
    error: { type: String, default: null, maxlength: 500 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, collection: "video_captions" }
);

VideoCaptionSchema.index(
  { organization_id: 1, media_asset_id: 1, language: 1 },
  { unique: true }
);

export const VideoCaption =
  (mongoose.models.VideoCaption as mongoose.Model<VideoCaptionDoc> | undefined) ?? mongoose.model<VideoCaptionDoc>("VideoCaption", VideoCaptionSchema);
