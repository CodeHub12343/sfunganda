import mongoose, { Schema } from "mongoose";

export type SessionDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  token_hash: string; // sha256 of the opaque cookie value
  mfa_verified: boolean;
  user_agent: string;
  ip: string;
  issued_at: Date;
  last_seen_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
};

const SessionSchema = new Schema<SessionDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    user_id: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    token_hash: { type: String, required: true, unique: true, maxlength: 128 },
    mfa_verified: { type: Boolean, required: true, default: false },
    user_agent: { type: String, default: "", maxlength: 500 },
    ip: { type: String, default: "", maxlength: 64 },
    issued_at: { type: Date, required: true, default: () => new Date() },
    last_seen_at: { type: Date, required: true, default: () => new Date() },
    expires_at: { type: Date, required: true },
    revoked_at: { type: Date, default: null },
  },
  { collection: "sessions" }
);

// TTL — Mongo removes expired sessions automatically (§9.4).
SessionSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
SessionSchema.index({ user_id: 1, revoked_at: 1 });

export const Session =
  mongoose.models.Session ?? mongoose.model<SessionDoc>("Session", SessionSchema);
