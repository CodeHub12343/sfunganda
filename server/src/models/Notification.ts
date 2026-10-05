import mongoose, { Schema } from "mongoose";

// In-app notification shown on /dashboard. One row per user per event; the
// fan-out worker uses a dedup key per (user, source_event) so repeated
// processing of the same source event produces at most one row.
export type NotificationTopic =
  | "accomplishment_published"
  | "milestone_completed"
  | "project_update"
  | "donation_receipt"
  | "system";

export type NotificationDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  topic: NotificationTopic;
  title: string;
  body: string;
  // url within the public site to deep-link into.
  url: string | null;
  dedup_key: string;
  read_at: Date | null;
  // Snapshot of the delivered email so the dashboard can show "sent at …".
  email_delivery_id: mongoose.Types.ObjectId | null;
  created_at: Date;
};

const NotificationSchema = new Schema<NotificationDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    user_id: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    topic: {
      type: String,
      enum: ["accomplishment_published", "milestone_completed", "project_update", "donation_receipt", "system"],
      required: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, default: "", maxlength: 2000 },
    url: { type: String, default: null, maxlength: 500 },
    dedup_key: { type: String, required: true, maxlength: 200 },
    read_at: { type: Date, default: null },
    email_delivery_id: { type: Schema.Types.ObjectId, ref: "EmailDelivery", default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false }, collection: "notifications" }
);

NotificationSchema.index({ user_id: 1, dedup_key: 1 }, { unique: true });
NotificationSchema.index({ user_id: 1, read_at: 1, created_at: -1 });
NotificationSchema.index({ organization_id: 1, topic: 1, created_at: -1 });

export const Notification =
  mongoose.models.Notification ?? mongoose.model<NotificationDoc>("Notification", NotificationSchema);
