import mongoose, { Schema } from "mongoose";

// A loan — in either direction. "receivable" is money we lent out; "payable"
// is money we borrowed. The underlying cash movement is a FinancialTransaction;
// this record carries the repayment schedule and the running principal.
export type LoanDirection = "receivable" | "payable";
export type LoanStatus = "active" | "settled" | "defaulted" | "cancelled";

export type RepaymentSchedule = {
  due_on: Date;
  amount_cents: number;
  paid_on: Date | null;
  paid_amount_cents: number;
  transaction_id: mongoose.Types.ObjectId | null;
};

export type LoanDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  public_id: string | null;
  direction: LoanDirection;
  counterparty_name: string;
  counterparty_identifier: string | null;
  principal_cents: number;
  base_currency: string;
  outstanding_cents: number;
  interest_rate_bps: number;
  originated_on: Date;
  due_on: Date | null;
  fund_id: mongoose.Types.ObjectId;
  originating_transaction_id: mongoose.Types.ObjectId | null;
  schedule: RepaymentSchedule[];
  status: LoanStatus;
  memo: string;
  created_by: mongoose.Types.ObjectId;
  version: number;
  created_at: Date;
  updated_at: Date;
};

const ScheduleSchema = new Schema<RepaymentSchedule>(
  {
    due_on: { type: Date, required: true },
    amount_cents: { type: Number, required: true, min: 1 },
    paid_on: { type: Date, default: null },
    paid_amount_cents: { type: Number, default: 0 },
    transaction_id: { type: Schema.Types.ObjectId, ref: "FinancialTransaction", default: null },
  },
  { _id: false }
);

const LoanSchema = new Schema<LoanDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    public_id: { type: String, default: null, maxlength: 32 },
    direction: { type: String, enum: ["receivable", "payable"], required: true },
    counterparty_name: { type: String, required: true, maxlength: 200 },
    counterparty_identifier: { type: String, default: null, maxlength: 120 },
    principal_cents: { type: Number, required: true, min: 0 },
    base_currency: { type: String, required: true, maxlength: 3 },
    outstanding_cents: { type: Number, required: true, default: 0 },
    interest_rate_bps: { type: Number, default: 0, min: 0 },
    originated_on: { type: Date, required: true },
    due_on: { type: Date, default: null },
    fund_id: { type: Schema.Types.ObjectId, ref: "Fund", required: true },
    originating_transaction_id: { type: Schema.Types.ObjectId, ref: "FinancialTransaction", default: null },
    schedule: { type: [ScheduleSchema], default: [] },
    status: {
      type: String,
      enum: ["active", "settled", "defaulted", "cancelled"],
      required: true,
      default: "active",
    },
    memo: { type: String, default: "", maxlength: 2000 },
    created_by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    version: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, collection: "loans" }
);

LoanSchema.index(
  { organization_id: 1, public_id: 1 },
  { unique: true, partialFilterExpression: { public_id: { $type: "string" } } }
);
LoanSchema.index({ organization_id: 1, status: 1 });
LoanSchema.index({ organization_id: 1, counterparty_identifier: 1 }, { sparse: true });

export const Loan = (mongoose.models.Loan as mongoose.Model<LoanDoc> | undefined) ?? mongoose.model<LoanDoc>("Loan", LoanSchema);
