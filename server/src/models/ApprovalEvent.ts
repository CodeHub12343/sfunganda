import mongoose, { Schema } from "mongoose";

// Append-only (§9.4) record of each decision point in an accomplishment's
// life. One row per transition: submit, start_review, approve, reject,
// request_changes, publish.
export type ApprovalEventKind =
  | "submit"
  | "claim_review"
  | "approve"
  | "request_changes"
  | "reject"
  | "publish"
  | "withdraw"
  | "archive";

export type ApprovalEventDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  accomplishment_id: mongoose.Types.ObjectId;
  kind: ApprovalEventKind;
  by_user_id: mongoose.Types.ObjectId;
  by_role: string | null;
  note: string | null;
  safeguarding: Record<string, boolean> | null;
  from_state: string;
  to_state: string;
  version_at: number;
  created_at: Date;
};

const ApprovalEventSchema = new Schema<ApprovalEventDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    accomplishment_id: { type: Schema.Types.ObjectId, required: true, ref: "Accomplishment" },
    kind: {
      type: String,
      enum: ["submit", "claim_review", "approve", "request_changes", "reject", "publish", "withdraw", "archive"],
      required: true,
    },
    by_user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    by_role: { type: String, default: null, maxlength: 40 },
    note: { type: String, default: null, maxlength: 2000 },
    safeguarding: { type: Schema.Types.Mixed, default: null },
    from_state: { type: String, required: true, maxlength: 40 },
    to_state: { type: String, required: true, maxlength: 40 },
    version_at: { type: Number, required: true },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
    collection: "approval_events",
  }
);

ApprovalEventSchema.index({ accomplishment_id: 1, created_at: -1 });
ApprovalEventSchema.index({ organization_id: 1, created_at: -1 });
ApprovalEventSchema.index({ organization_id: 1, kind: 1, created_at: -1 });

export const ApprovalEvent =
  mongoose.models.ApprovalEvent ??
  mongoose.model<ApprovalEventDoc>("ApprovalEvent", ApprovalEventSchema);
