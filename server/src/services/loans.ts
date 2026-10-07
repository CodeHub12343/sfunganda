import mongoose from "mongoose";
import { Fund, IdSequence, Loan } from "@/models/index.js";
import type { LoanDirection, LoanDoc, RepaymentSchedule } from "@/models/Loan.js";
import { AppError } from "@/util/errors.js";
import { can, type Actor } from "@/policy/index.js";
import { createDraft } from "./finance.js";

type ScheduleInput = { due_on: string; amount_cents: number };

export async function createLoan(
  actor: Actor,
  input: {
    direction: LoanDirection;
    counterparty_name: string;
    counterparty_identifier?: string;
    principal_cents: number;
    base_currency: string;
    originated_on: string;
    due_on?: string;
    interest_rate_bps?: number;
    fund_code: string;
    schedule?: ScheduleInput[];
    memo?: string;
  }
): Promise<LoanDoc> {
  if (!can(actor, "finance.write", { kind: "finance", organization_id: actor.organization_id }))
    throw new AppError("forbidden", "cannot create loans");
  if (input.principal_cents <= 0)
    throw new AppError("unprocessable", "principal must be positive");

  const orgId = new mongoose.Types.ObjectId(actor.organization_id);
  const fund = await Fund.findOne({ organization_id: orgId, code: input.fund_code }).lean();
  if (!fund) throw new AppError("not_found", "fund not found");

  const schedule: RepaymentSchedule[] = (input.schedule ?? []).map((s) => ({
    due_on: new Date(s.due_on),
    amount_cents: s.amount_cents,
    paid_on: null,
    paid_amount_cents: 0,
    transaction_id: null,
  }));

  const year = new Date().getUTCFullYear();
  const seq = await IdSequence.findOneAndUpdate(
    { organization_id: orgId, kind: "loan", year },
    { $inc: { next_value: 1 }, $setOnInsert: { organization_id: orgId, kind: "loan", year } },
    { upsert: true, new: true }
  );
  const public_id = `LN-${year}-${(seq.next_value - 1).toString().padStart(4, "0")}`;

  // Record the originating cash movement as a draft transaction. The caller
  // runs the normal approve/post flow afterwards.
  const originating = await createDraft(actor, {
    kind: input.direction === "receivable" ? "adjustment" : "adjustment",
    source_currency: input.base_currency,
    source_amount_cents: input.principal_cents,
    base_currency: input.base_currency,
    base_amount_cents: input.principal_cents,
    occurred_on: input.originated_on,
    memo: `${input.direction === "receivable" ? "Loan to" : "Loan from"} ${input.counterparty_name} (${public_id})`,
    lines:
      input.direction === "receivable"
        ? [
            { side: "debit", fund_id: fund._id.toString(), account: "loan_receivable", amount_cents: input.principal_cents },
            { side: "credit", fund_id: fund._id.toString(), account: "cash", amount_cents: input.principal_cents },
          ]
        : [
            { side: "debit", fund_id: fund._id.toString(), account: "cash", amount_cents: input.principal_cents },
            { side: "credit", fund_id: fund._id.toString(), account: "loan_payable", amount_cents: input.principal_cents },
          ],
  });

  const doc = await Loan.create({
    organization_id: orgId,
    public_id,
    direction: input.direction,
    counterparty_name: input.counterparty_name,
    counterparty_identifier: input.counterparty_identifier ?? null,
    principal_cents: input.principal_cents,
    outstanding_cents: input.principal_cents,
    base_currency: input.base_currency.toUpperCase(),
    interest_rate_bps: input.interest_rate_bps ?? 0,
    originated_on: new Date(input.originated_on),
    due_on: input.due_on ? new Date(input.due_on) : null,
    fund_id: fund._id,
    originating_transaction_id: originating._id,
    schedule,
    status: "active",
    memo: input.memo ?? "",
    created_by: new mongoose.Types.ObjectId(actor.user_id),
  });
  return doc.toObject();
}

export async function listLoans(actor: Actor): Promise<LoanDoc[]> {
  if (!can(actor, "finance.read", { kind: "finance", organization_id: actor.organization_id }))
    throw new AppError("forbidden", "cannot list loans");
  return Loan.find({
    organization_id: new mongoose.Types.ObjectId(actor.organization_id),
  })
    .sort({ created_at: -1 })
    .lean<LoanDoc[]>();
}

export async function recordRepayment(
  actor: Actor,
  loan_id: string,
  input: { schedule_index: number; paid_on: string; paid_amount_cents: number; transaction_id?: string }
): Promise<LoanDoc> {
  if (!can(actor, "finance.write", { kind: "finance", organization_id: actor.organization_id }))
    throw new AppError("forbidden", "cannot record repayment");
  const orgId = new mongoose.Types.ObjectId(actor.organization_id);
  const loan = await Loan.findOne({ _id: loan_id, organization_id: orgId });
  if (!loan) throw new AppError("not_found", "loan not found");
  const s = loan.schedule[input.schedule_index];
  if (!s) throw new AppError("not_found", "schedule row not found");
  s.paid_on = new Date(input.paid_on);
  s.paid_amount_cents = input.paid_amount_cents;
  if (input.transaction_id) s.transaction_id = new mongoose.Types.ObjectId(input.transaction_id);
  loan.outstanding_cents = Math.max(0, loan.outstanding_cents - input.paid_amount_cents);
  if (loan.outstanding_cents === 0) loan.status = "settled";
  loan.version += 1;
  await loan.save();
  return loan.toObject();
}
