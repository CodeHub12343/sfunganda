import mongoose, { Schema } from "mongoose";

// Append-only idempotency log for Stripe webhooks. Every delivered event is
// recorded here BEFORE its side-effects run, so a replay of the same event
// id is a no-op. We also store the raw payload so we can replay in dev.
export type StripeEventDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  stripe_event_id: string;
  type: string;
  livemode: boolean;
  received_at: Date;
  processed_at: Date | null;
  outcome: "pending" | "processed" | "ignored" | "error";
  error_message: string | null;
  payload: Record<string, unknown>;
  created_at: Date;
};

const StripeEventSchema = new Schema<StripeEventDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    stripe_event_id: { type: String, required: true, maxlength: 128 },
    type: { type: String, required: true, maxlength: 80 },
    livemode: { type: Boolean, required: true },
    received_at: { type: Date, required: true },
    processed_at: { type: Date, default: null },
    outcome: {
      type: String,
      enum: ["pending", "processed", "ignored", "error"],
      default: "pending",
    },
    error_message: { type: String, default: null, maxlength: 2000 },
    payload: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false }, collection: "stripe_events" }
);

StripeEventSchema.index({ organization_id: 1, stripe_event_id: 1 }, { unique: true });
StripeEventSchema.index({ organization_id: 1, type: 1, received_at: -1 });

export const StripeEvent =
  mongoose.models.StripeEvent ??
  mongoose.model<StripeEventDoc>("StripeEvent", StripeEventSchema);
