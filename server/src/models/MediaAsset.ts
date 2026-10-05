import mongoose, { Schema } from "mongoose";

export type MediaKind = "photo" | "document" | "video";
export type MediaStatus =
  | "ticketed"
  | "uploading"
  | "pending_scan"
  | "pending_processing"
  | "ready"
  | "rejected"
  | "deleted";
export type MediaVisibility = "internal" | "public";

export type MediaDerivative = {
  variant: string;
  key: string;
  bucket: string;
  bytes: number;
  width: number | null;
  height: number | null;
  mime: string;
};

export type MediaFlag = {
  reason: "unsafe" | "offtopic" | "copyright" | "pii" | "other";
  note: string | null;
  by_user_id: mongoose.Types.ObjectId | null;
  at: Date;
  resolved_at: Date | null;
};

export type MediaAssetDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  kind: MediaKind;
  status: MediaStatus;
  visibility: MediaVisibility;

  // Storage
  bucket: string;
  key: string; // original object key
  mime_declared: string;
  mime_detected: string | null;
  bytes: number;
  sha256: string | null;

  // Media-specific
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  exif_stripped: boolean;

  // Derivatives (thumbs, webp, poster frames)
  derivatives: MediaDerivative[];

  // Video provider (Cloudflare Stream)
  provider: {
    name: "stream" | null;
    asset_id: string | null;
    playback_id: string | null;
    ready: boolean;
  };

  // Multipart upload (resume support)
  upload: {
    multipart_upload_id: string | null;
    parts_received: number;
  };

  // Scan + review state
  scan: { status: "pending" | "clean" | "infected" | "error"; signature: string | null; at: Date | null };
  flags: MediaFlag[];
  alt_text: string | null;
  caption: string | null;

  // Lifecycle
  uploaded_by: mongoose.Types.ObjectId | null;
  uploaded_at: Date | null;
  deleted_at: Date | null;

  // Original file name as supplied by uploader (never used as a key).
  original_filename: string;

  created_at: Date;
  updated_at: Date;
};

const DerivativeSchema = new Schema<MediaDerivative>(
  {
    variant: { type: String, required: true, maxlength: 32 },
    key: { type: String, required: true, maxlength: 256 },
    bucket: { type: String, required: true, maxlength: 64 },
    bytes: { type: Number, required: true },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    mime: { type: String, required: true, maxlength: 64 },
  },
  { _id: false }
);

const FlagSchema = new Schema<MediaFlag>(
  {
    reason: { type: String, enum: ["unsafe", "offtopic", "copyright", "pii", "other"], required: true },
    note: { type: String, maxlength: 500, default: null },
    by_user_id: { type: Schema.Types.ObjectId, ref: "User", default: null },
    at: { type: Date, default: () => new Date() },
    resolved_at: { type: Date, default: null },
  },
  { _id: false }
);

const MediaAssetSchema = new Schema<MediaAssetDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    kind: { type: String, enum: ["photo", "document", "video"], required: true },
    status: {
      type: String,
      enum: ["ticketed", "uploading", "pending_scan", "pending_processing", "ready", "rejected", "deleted"],
      required: true,
      default: "ticketed",
    },
    visibility: { type: String, enum: ["internal", "public"], required: true, default: "internal" },

    bucket: { type: String, required: true, maxlength: 64 },
    key: { type: String, required: true, maxlength: 256 },
    mime_declared: { type: String, required: true, maxlength: 128 },
    mime_detected: { type: String, default: null, maxlength: 128 },
    bytes: { type: Number, required: true },
    sha256: { type: String, default: null, maxlength: 64 },

    width: { type: Number, default: null },
    height: { type: Number, default: null },
    duration_seconds: { type: Number, default: null },
    exif_stripped: { type: Boolean, default: false },

    derivatives: { type: [DerivativeSchema], default: [] },

    provider: {
      name: { type: String, enum: ["stream", null], default: null },
      asset_id: { type: String, default: null, maxlength: 128 },
      playback_id: { type: String, default: null, maxlength: 128 },
      ready: { type: Boolean, default: false },
    },

    upload: {
      multipart_upload_id: { type: String, default: null, maxlength: 256 },
      parts_received: { type: Number, default: 0 },
    },

    scan: {
      status: { type: String, enum: ["pending", "clean", "infected", "error"], default: "pending" },
      signature: { type: String, default: null, maxlength: 200 },
      at: { type: Date, default: null },
    },
    flags: { type: [FlagSchema], default: [] },
    alt_text: { type: String, default: null, maxlength: 500 },
    caption: { type: String, default: null, maxlength: 2000 },

    uploaded_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    uploaded_at: { type: Date, default: null },
    deleted_at: { type: Date, default: null },
    original_filename: { type: String, required: true, maxlength: 255 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, collection: "media_assets" }
);

MediaAssetSchema.index({ organization_id: 1, kind: 1, status: 1, created_at: -1 });
MediaAssetSchema.index({ organization_id: 1, visibility: 1, status: 1, created_at: -1 });
MediaAssetSchema.index({ "provider.asset_id": 1 }, { sparse: true });
MediaAssetSchema.index({ bucket: 1, key: 1 }, { unique: true });

export const MediaAsset =
  mongoose.models.MediaAsset ?? mongoose.model<MediaAssetDoc>("MediaAsset", MediaAssetSchema);
