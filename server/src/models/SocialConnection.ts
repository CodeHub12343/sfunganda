import mongoose, { Schema } from "mongoose";

// =============================================================================
// Phase 12 — OAuth connection to one social platform channel.
//
// We allow at most one active connection per (organization, platform,
// channel_id). Reconnecting a revoked connection creates a new row rather
// than editing the old one — the token history is append-only so we can
// show operators when they last reconnected.
//
// Tokens are AES-256-GCM encrypted (see services/socialTokens.ts).
// =============================================================================

export type SocialPlatform = "youtube" | "facebook" | "instagram" | "tiktok";

export type EncryptedBlob = {
  v: 1;
  kid: string;
  iv: string;
  ct: string;
  tag: string;
};

export type SocialConnectionDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  platform: SocialPlatform;
  // The platform's own identifier for the channel/page. Scopes posts to a
  // specific destination when the OAuth app has access to several.
  channel_id: string;
  channel_name: string;
  // Encrypted refresh_token. For platforms that don't issue refresh tokens
  // (short-lived access only) we keep the access_token here and refresh it
  // via the platform's long-lived-token flow (Facebook Graph) — the row
  // schema stays the same.
  refresh_token_ct: EncryptedBlob | null;
  // Short-lived access token the publisher uses right now. Set during the
  // OAuth callback and whenever a refresh succeeds.
  access_token_ct: EncryptedBlob | null;
  access_token_expires_at: Date | null;
  scopes: string[];
  // Lifecycle. A reconnection creates a new row and marks any older ones
  // as `revoked`.
  status: "active" | "revoked" | "error";
  last_error: string | null;
  connected_by: mongoose.Types.ObjectId;
  connected_at: Date;
  revoked_at: Date | null;
  revoked_by: mongoose.Types.ObjectId | null;
  created_at: Date;
  updated_at: Date;
};

const EncryptedBlobSchema = new Schema<EncryptedBlob>(
  {
    v: { type: Number, enum: [1], required: true },
    kid: { type: String, required: true, maxlength: 32 },
    iv: { type: String, required: true, maxlength: 64 },
    ct: { type: String, required: true, maxlength: 8000 },
    tag: { type: String, required: true, maxlength: 64 },
  },
  { _id: false }
);

const SocialConnectionSchema = new Schema<SocialConnectionDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    platform: {
      type: String,
      enum: ["youtube", "facebook", "instagram", "tiktok"],
      required: true,
    },
    channel_id: { type: String, required: true, maxlength: 128 },
    channel_name: { type: String, required: true, maxlength: 200 },
    refresh_token_ct: { type: EncryptedBlobSchema, default: null },
    access_token_ct: { type: EncryptedBlobSchema, default: null },
    access_token_expires_at: { type: Date, default: null },
    scopes: { type: [String], default: [] },
    status: { type: String, enum: ["active", "revoked", "error"], required: true, default: "active" },
    last_error: { type: String, default: null, maxlength: 500 },
    connected_by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    connected_at: { type: Date, required: true, default: () => new Date() },
    revoked_at: { type: Date, default: null },
    revoked_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, collection: "social_connections" }
);

// One ACTIVE row per (org, platform, channel_id). Revoked/error rows don't
// participate in the uniqueness constraint.
SocialConnectionSchema.index(
  { organization_id: 1, platform: 1, channel_id: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
);
SocialConnectionSchema.index({ organization_id: 1, status: 1, platform: 1 });

export const SocialConnection =
  mongoose.models.SocialConnection ??
  mongoose.model<SocialConnectionDoc>("SocialConnection", SocialConnectionSchema);
