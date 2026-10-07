import mongoose, { Schema } from "mongoose";

export type UserStatus = "pending" | "active" | "suspended";

export type UserDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  email: string; // lowercase
  display_name: string;
  password_hash: string | null; // null until invitation accepted
  mfa_secret: string | null;
  mfa_enrolled_at: Date | null;
  mfa_recovery_codes_hashed: string[]; // hashed; one-time use
  status: UserStatus;
  invited_by: mongoose.Types.ObjectId | null;
  invite_token_hash: string | null; // sha256 of the invite token
  invite_expires_at: Date | null;
  // Supporter email verification (Phase 7). Supporters self-sign-up and are
  // created in status: "pending" until they click a mailed link. Staff users
  // (invited via admin) are considered verified at invite-accept time.
  email_verified_at: Date | null;
  verification_token_hash: string | null;
  verification_expires_at: Date | null;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
  version: number;
};

const UserSchema = new Schema<UserDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    // Case-insensitive uniqueness: we always store lowercase and index unique.
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    display_name: { type: String, required: true, maxlength: 120, trim: true },
    password_hash: { type: String, default: null },
    mfa_secret: { type: String, default: null },
    mfa_enrolled_at: { type: Date, default: null },
    mfa_recovery_codes_hashed: { type: [String], default: [] },
    status: { type: String, enum: ["pending", "active", "suspended"], required: true, default: "pending" },
    invited_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    invite_token_hash: { type: String, default: null },
    invite_expires_at: { type: Date, default: null },
    email_verified_at: { type: Date, default: null },
    verification_token_hash: { type: String, default: null },
    verification_expires_at: { type: Date, default: null },
    last_login_at: { type: Date, default: null },
    version: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, collection: "users" }
);

UserSchema.index({ organization_id: 1, email: 1 }, { unique: true });
UserSchema.index({ invite_token_hash: 1 }, { sparse: true });

export const User = (mongoose.models.User as mongoose.Model<UserDoc> | undefined) ?? mongoose.model<UserDoc>("User", UserSchema);
