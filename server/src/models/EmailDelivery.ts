import mongoose, { Schema } from "mongoose";

// A single email we attempted to send. One row per (user, template,
// idempotency_key) to prevent double-sending across worker retries. The
// template name maps to a function in src/mail/.
export type EmailDeliveryStatus =
  | "queued"
  | "sending"
  | "sent"
  | "bounced"
  | "complained"
  | "failed";

export type EmailDeliveryDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId | null;
  to_email: string;
  template: string;
  idempotency_key: string;
  subject: string;
  payload: Record<string, unknown>;
  status: EmailDeliveryStatus;
  attempts: number;
  sent_at: Date | null;
  error_message: string | null;
  provider_message_id: string | null;
  created_at: Date;
  updated_at: Date;
};

const EmailDeliverySchema = new Schema<EmailDeliveryDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    user_id: { type: Schema.Types.ObjectId, ref: "User", default: null },
    to_email: { type: String, required: true, lowercase: true, maxlength: 254 },
    template: { type: String, required: true, maxlength: 80 },
    idempotency_key: { type: String, required: true, maxlength: 128 },
    subject: { type: String, required: true, maxlength: 200 },
    payload: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ["queued", "sending", "sent", "bounced", "complained", "failed"],
      required: true,
      default: "queued",
    },
    attempts: { type: Number, default: 0 },
    sent_at: { type: Date, default: null },
    error_message: { type: String, default: null, maxlength: 2000 },
    provider_message_id: { type: String, default: null, maxlength: 128 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, collection: "email_deliveries" }
);

EmailDeliverySchema.index(
  { organization_id: 1, idempotency_key: 1 },
  { unique: true }
);
EmailDeliverySchema.index({ organization_id: 1, status: 1, created_at: -1 });
EmailDeliverySchema.index({ to_email: 1, template: 1, created_at: -1 });

export const EmailDelivery =
  mongoose.models.EmailDelivery ??
  mongoose.model<EmailDeliveryDoc>("EmailDelivery", EmailDeliverySchema);
