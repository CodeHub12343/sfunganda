import mongoose from "mongoose";
import { Fund } from "@/models/index.js";
import type { FundDoc } from "@/models/Fund.js";
import { AppError } from "@/util/errors.js";
import { can, type Actor } from "@/policy/index.js";
import { createDraft, type TransactionInput } from "./finance.js";
import type { FinancialTransactionDoc } from "@/models/FinancialTransaction.js";

// A fund allocation is a balanced two-line transfer: debit cash on the
// destination fund, credit cash on the source. It goes through the normal
// transaction state machine (draft -> submitted -> approved -> posted), so
// a high-value allocation also hits the dual-approval gate.
export async function createAllocationDraft(
  actor: Actor,
  input: {
    source_fund_id: string;
    destination_fund_id: string;
    amount_cents: number;
    occurred_on: string;
    memo?: string;
    document_ids?: string[];
  }
): Promise<FinancialTransactionDoc> {
  if (!can(actor, "finance.write", { kind: "finance", organization_id: actor.organization_id }))
    throw new AppError("forbidden", "cannot allocate");
  if (input.amount_cents <= 0) throw new AppError("unprocessable", "amount must be positive");
  if (input.source_fund_id === input.destination_fund_id)
    throw new AppError("unprocessable", "source and destination must differ");

  const orgId = new mongoose.Types.ObjectId(actor.organization_id);
  const [source, dest] = await Promise.all([
    Fund.findOne({ _id: input.source_fund_id, organization_id: orgId }).lean<FundDoc>(),
    Fund.findOne({ _id: input.destination_fund_id, organization_id: orgId }).lean<FundDoc>(),
  ]);
  if (!source || !dest) throw new AppError("not_found", "fund not found");
  if (source.base_currency !== dest.base_currency)
    throw new AppError("unprocessable", "allocations between different currencies not supported");

  if (source.balance_cents < input.amount_cents) {
    throw new AppError("unprocessable", "insufficient source fund balance", {
      fields: { amount_cents: `max ${source.balance_cents}` },
    });
  }

  // Transfers use the "transfer_out" / "transfer_in" accounts so they do
  // not inflate donation or expense totals on reports. Both lines touch
  // "cash" so fund balances move correctly.
  const payload: TransactionInput = {
    kind: "transfer",
    source_currency: source.base_currency,
    source_amount_cents: input.amount_cents,
    base_currency: source.base_currency,
    base_amount_cents: input.amount_cents,
    occurred_on: input.occurred_on,
    memo: input.memo ?? `Allocation ${source.code} -> ${dest.code}`,
    document_ids: input.document_ids,
    lines: [
      { side: "credit", fund_id: input.source_fund_id, account: "cash", amount_cents: input.amount_cents },
      { side: "debit", fund_id: input.destination_fund_id, account: "cash", amount_cents: input.amount_cents },
    ],
  };
  return createDraft(actor, payload);
}
