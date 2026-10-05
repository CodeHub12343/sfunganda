import mongoose, { Schema } from "mongoose";

// Public-facing supporter preferences and display. One row per user that
// signed up through the public /supporters/signup flow. Staff users may
// also have a profile if they later follow a project themselves.
export type NotificationChannel = "email" | "in_app";
export type NotificationFrequency = "immediate" | "daily_digest" | "weekly_digest" | "off";

export type NotificationPrefs = {
  // Per-topic frequency. Topics are stable keys the fan-out routes by.
  accomplishment_published: NotificationFrequency;
  milestone_completed: NotificationFrequency;
  project_update: NotificationFrequency;
  // Receipts always send (they're transactional); included here so a
  // supporter can request a copy by email.
  donation_receipt: NotificationFrequency;
  // Channels. Email on by default; in_app always on.
  channels: {
    email: boolean;
    in_app: boolean;
  };
  // Global override.
  unsubscribed_all: boolean;
};

export type SupporterProfileDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  display_name: string;
  anonymous_on_wall: boolean;
  country: string | null;
  // Preferences
  prefs: NotificationPrefs;
  // One-click unsubscribe token (per profile; replaced on reset)
  unsubscribe_token_hash: string;
  // Deletion lifecycle (self-service, §Phase 7 Backend)
  deletion_requested_at: Date | null;
  deletion_due_at: Date | null;
  created_at: Date;
  updated_at: Date;
  version: number;
};

const PrefsSchema = new Schema<NotificationPrefs>(
  {
    accomplishment_published: {
      type: String,
      enum: ["immediate", "daily_digest", "weekly_digest", "off"],
      default: "immediate",
    },
    milestone_completed: {
      type: String,
      enum: ["immediate", "daily_digest", "weekly_digest", "off"],
      default: "weekly_digest",
    },
    project_update: {
      type: String,
      enum: ["immediate", "daily_digest", "weekly_digest", "off"],
      default: "weekly_digest",
    },
    donation_receipt: {
      type: String,
      enum: ["immediate", "daily_digest", "weekly_digest", "off"],
      default: "immediate",
    },
    channels: {
      email: { type: Boolean, default: true },
      in_app: { type: Boolean, default: true },
    },
    unsubscribed_all: { type: Boolean, default: false },
  },
  { _id: false }
);

const SupporterProfileSchema = new Schema<SupporterProfileDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    user_id: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    display_name: { type: String, required: true, maxlength: 120 },
    anonymous_on_wall: { type: Boolean, default: false },
    country: { type: String, default: null, maxlength: 80 },
    prefs: { type: PrefsSchema, required: true, default: () => ({}) as NotificationPrefs },
    unsubscribe_token_hash: { type: String, required: true, maxlength: 64 },
    deletion_requested_at: { type: Date, default: null },
    deletion_due_at: { type: Date, default: null },
    version: { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "supporter_profiles",
  }
);

SupporterProfileSchema.index({ organization_id: 1, user_id: 1 }, { unique: true });
SupporterProfileSchema.index({ unsubscribe_token_hash: 1 }, { unique: true });

export const SupporterProfile =
  mongoose.models.SupporterProfile ??
  mongoose.model<SupporterProfileDoc>("SupporterProfile", SupporterProfileSchema);
