import mongoose, { Schema } from "mongoose";

// An accounting period is a month-sized bucket. "open" accepts postings;
// "pending_close" is a review window where new postings are blocked but
// adjustments can still be approved; "closed" is fully locked — a post or
// reversal that lands in the window is rejected. Reopening is an audit
// event, not a silent flip.
export type PeriodStatus = "open" | "pending_close" | "closed";

export type AccountingPeriodDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  code: string; // "2026-02"
  starts_on: Date;
  ends_on: Date;
  status: PeriodStatus;
  closed_by: mongoose.Types.ObjectId | null;
  closed_at: Date | null;
  // Snapshot of totals captured at close, so a future reopen+recompute can be
  // compared to the published figures.
  snapshot: {
    gross_received_cents: number;
    fees_cents: number;
    net_received_cents: number;
    expenses_cents: number;
    by_fund: Record<string, { balance_cents: number; in_cents: number; out_cents: number }>;
    base_currency: string;
    taken_at: Date;
  } | null;
  reopened_count: number;
  version: number;
  created_at: Date;
  updated_at: Date;
};

const AccountingPeriodSchema = new Schema<AccountingPeriodDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    code: { type: String, required: true, maxlength: 10 },
    starts_on: { type: Date, required: true },
    ends_on: { type: Date, required: true },
    status: {
      type: String,
      enum: ["open", "pending_close", "closed"],
      required: true,
      default: "open",
    },
    closed_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    closed_at: { type: Date, default: null },
    snapshot: { type: Schema.Types.Mixed, default: null },
    reopened_count: { type: Number, default: 0 },
    version: { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "accounting_periods",
  }
);

AccountingPeriodSchema.index({ organization_id: 1, code: 1 }, { unique: true });
AccountingPeriodSchema.index({ organization_id: 1, status: 1 });

export const AccountingPeriod =
  mongoose.models.AccountingPeriod ??
  mongoose.model<AccountingPeriodDoc>("AccountingPeriod", AccountingPeriodSchema);
