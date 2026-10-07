import mongoose, { Schema } from "mongoose";

// =============================================================================
// Phase 12 — One row per (accomplishment, media_asset, connection). The
// outbox handler `social.post` claims a row by its `_id` and tries to
// publish. Idempotency key covers (accomplishment, media, connection) so
// a redelivery of the fan-out event never duplicates a post.
//
// IMPORTANT (§14.7): a social failure NEVER rolls back the public
// publication of the accomplishment. The site is the system of record;
// social is a downstream effect that may retry, fail, or succeed
// independently.
// =============================================================================

export type SocialPostState = "queued" | "posting" | "posted" | "failed" | "skipped";

export type SocialPostDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  accomplishment_id: mongoose.Types.ObjectId;
  media_asset_id: mongoose.Types.ObjectId;
  connection_id: mongoose.Types.ObjectId;
  platform: string;
  state: SocialPostState;
  // The platform's post identifier and canonical URL, set on success.
  external_id: string | null;
  external_url: string | null;
  caption: string;
  attempts: number;
  last_error: string | null;
  // Set when the row is `skipped` and names the reason — missing social
  // consent, revoked connection, or feature-disabled.
  skip_reason: string | null;
  // Operator who requested a manual retry (if any).
  retried_by: mongoose.Types.ObjectId | null;
  retried_at: Date | null;
  // Idempotency: (accomplishment, media, connection) is unique.
  idempotency_key: string;
  created_at: Date;
  updated_at: Date;
};

const SocialPostSchema = new Schema<SocialPostDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    accomplishment_id: { type: Schema.Types.ObjectId, required: true, ref: "Accomplishment" },
    media_asset_id: { type: Schema.Types.ObjectId, required: true, ref: "MediaAsset" },
    connection_id: { type: Schema.Types.ObjectId, required: true, ref: "SocialConnection" },
    platform: { type: String, required: true, maxlength: 30 },
    state: {
      type: String,
      enum: ["queued", "posting", "posted", "failed", "skipped"],
      required: true,
      default: "queued",
    },
    external_id: { type: String, default: null, maxlength: 128 },
    external_url: { type: String, default: null, maxlength: 500 },
    caption: { type: String, default: "", maxlength: 2000 },
    attempts: { type: Number, required: true, default: 0, min: 0 },
    last_error: { type: String, default: null, maxlength: 500 },
    skip_reason: { type: String, default: null, maxlength: 120 },
    retried_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    retried_at: { type: Date, default: null },
    idempotency_key: { type: String, required: true, maxlength: 120 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, collection: "social_posts" }
);

SocialPostSchema.index({ organization_id: 1, idempotency_key: 1 }, { unique: true });
SocialPostSchema.index({ organization_id: 1, state: 1, created_at: -1 });
SocialPostSchema.index({ organization_id: 1, accomplishment_id: 1 });
SocialPostSchema.index({ organization_id: 1, connection_id: 1, state: 1 });

export const SocialPost =
  (mongoose.models.SocialPost as mongoose.Model<SocialPostDoc> | undefined) ?? mongoose.model<SocialPostDoc>("SocialPost", SocialPostSchema);
