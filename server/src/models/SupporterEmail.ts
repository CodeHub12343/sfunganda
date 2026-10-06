import mongoose, { Schema } from "mongoose";

// Secondary email addresses attached to a supporter account. The user's
// primary email lives on the User document; this collection holds the
// additional addresses they want donations to be linked to.
//
// An email belongs to at most one supporter in a given organization: the
// unique index on (organization_id, email) enforces this so two accounts
// cannot both claim the same billing email.
export type SupporterEmailDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  email: string; // normalized (trim + lowercase)
  verified_at: Date | null;
  verification_token_hash: string | null;
  verification_expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

const SupporterEmailSchema = new Schema<SupporterEmailDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    user_id: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    email: { type: String, required: true, maxlength: 254 },
    verified_at: { type: Date, default: null },
    verification_token_hash: { type: String, default: null, maxlength: 128 },
    verification_expires_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "supporter_emails",
  }
);

SupporterEmailSchema.index({ organization_id: 1, email: 1 }, { unique: true });
SupporterEmailSchema.index({ organization_id: 1, user_id: 1 });

export const SupporterEmail =
  (mongoose.models.SupporterEmail as mongoose.Model<SupporterEmailDoc> | undefined) ??
  mongoose.model<SupporterEmailDoc>("SupporterEmail", SupporterEmailSchema);
