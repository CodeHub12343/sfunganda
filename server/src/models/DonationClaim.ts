import mongoose, { Schema } from "mongoose";

// A supporter's attempt to attach a historic donation to their account.
// Created when they submit a donation reference; a six-digit code is
// emailed to the donation's original billing email, proving ownership
// of that mailbox. Only on `verify` with the correct code within the
// TTL do we set supporter_user_id on the Donation.
//
// Rate limited by (user_id, donation_id) — one open claim at a time —
// and by attempts (we lock the claim after too many wrong codes).
export type DonationClaimDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  donation_id: mongoose.Types.ObjectId;
  code_hash: string;
  expires_at: Date;
  attempts: number;
  sent_to_email: string; // where the code was mailed (normalized)
  claimed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

const DonationClaimSchema = new Schema<DonationClaimDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    user_id: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    donation_id: { type: Schema.Types.ObjectId, required: true, ref: "Donation" },
    code_hash: { type: String, required: true, maxlength: 128 },
    expires_at: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    sent_to_email: { type: String, required: true, maxlength: 254 },
    claimed_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "donation_claims",
  }
);

DonationClaimSchema.index(
  { organization_id: 1, user_id: 1, donation_id: 1 },
  { unique: true }
);

export const DonationClaim =
  (mongoose.models.DonationClaim as mongoose.Model<DonationClaimDoc> | undefined) ??
  mongoose.model<DonationClaimDoc>("DonationClaim", DonationClaimSchema);
