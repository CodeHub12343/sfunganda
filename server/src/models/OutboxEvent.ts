import mongoose, { Schema } from "mongoose";

// Transactional outbox (§18). Services write events here inside the same
// transaction as the state change; the worker publishes them later. Status
// transitions: pending → in_progress → done | failed.

export type OutboxStatus = "pending" | "in_progress" | "done" | "failed";

export type OutboxEventDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  topic: string; // e.g. "mail.invite", "stripe.checkout.create"
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  available_at: Date; // next earliest attempt
  locked_until: Date | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
};

const OutboxEventSchema = new Schema<OutboxEventDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    topic: { type: String, required: true, maxlength: 80 },
    payload: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["pending", "in_progress", "done", "failed"],
      required: true,
      default: "pending",
    },
    attempts: { type: Number, required: true, default: 0 },
    available_at: { type: Date, required: true, default: () => new Date() },
    locked_until: { type: Date, default: null },
    last_error: { type: String, default: null, maxlength: 2000 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, collection: "outbox_events" }
);

OutboxEventSchema.index({ status: 1, available_at: 1 });
OutboxEventSchema.index({ topic: 1, status: 1 });

export const OutboxEvent =
  (mongoose.models.OutboxEvent as mongoose.Model<OutboxEventDoc> | undefined) ?? mongoose.model<OutboxEventDoc>("OutboxEvent", OutboxEventSchema);
