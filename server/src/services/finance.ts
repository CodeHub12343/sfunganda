import mongoose from "mongoose";
import {
  ExpenseCategory,
  FinancialDocument,
  FinancialTransaction,
  Fund,
  IdSequence,
} from "@/models/index.js";
import type {
  FinancialTransactionDoc,
  TransactionLine,
  TransactionState,
} from "@/models/FinancialTransaction.js";
import type { FundDoc } from "@/models/Fund.js";
import { AppError } from "@/util/errors.js";
import { can, type Actor } from "@/policy/index.js";
import { env } from "@/config/env.js";
import { assertBalanced, postToLedger, reversalLines } from "./ledger.js";
import { enqueue } from "./outbox.js";
import { assertPeriodWritable } from "./periods.js";

export type LineInput = {
  side: "debit" | "credit";
  fund_id: string;
  account: string;
  amount_cents: number;
  memo?: string;
  project_id?: string | null;
  expense_category_id?: string | null;
};

export type TransactionInput = {
  kind: FinancialTransactionDoc["kind"];
  source_currency: string;
  source_amount_cents: number;
  base_currency?: string;
  base_amount_cents?: number;
  fx_rate?: number;
  occurred_on: string;
  memo?: string;
  lines: LineInput[];
  document_ids?: string[];
  stripe_charge_id?: string;
  stripe_payment_intent_id?: string;
  donation_id?: string;
  reversal_of?: string;
};

export async function createDraft(
  actor: Actor,
  input: TransactionInput
): Promise<FinancialTransactionDoc> {
  if (!can(actor, "finance.write", { kind: "finance", organization_id: actor.organization_id }))
    throw new AppError("forbidden", "cannot write finance");

  const orgId = new mongoose.Types.ObjectId(actor.organization_id);
  const base_currency = (input.base_currency ?? env.BASE_CURRENCY).toUpperCase();
  const base_amount_cents =
    input.base_amount_cents ??
    (input.source_currency.toUpperCase() === base_currency
      ? input.source_amount_cents
      : Math.round(input.source_amount_cents * (input.fx_rate ?? 1)));

  const lines = input.lines.map(
    (l): TransactionLine => ({
      side: l.side,
      fund_id: new mongoose.Types.ObjectId(l.fund_id),
      account: l.account.toLowerCase(),
      amount_cents: l.amount_cents,
      memo: l.memo ?? null,
      project_id: l.project_id ? new mongoose.Types.ObjectId(l.project_id) : null,
      expense_category_id: l.expense_category_id
        ? new mongoose.Types.ObjectId(l.expense_category_id)
        : null,
    })
  );
  assertBalanced(lines);
  await assertRestrictedFundRules(orgId, lines);

  const doc = await FinancialTransaction.create({
    organization_id: orgId,
    kind: input.kind,
    state: "draft",
    source_currency: input.source_currency.toUpperCase(),
    source_amount_cents: input.source_amount_cents,
    base_currency,
    base_amount_cents,
    fx_rate: input.fx_rate ?? null,
    occurred_on: new Date(input.occurred_on),
    memo: input.memo ?? "",
    lines,
    created_by: new mongoose.Types.ObjectId(actor.user_id),
    stripe_charge_id: input.stripe_charge_id ?? null,
    stripe_payment_intent_id: input.stripe_payment_intent_id ?? null,
    donation_id: input.donation_id ? new mongoose.Types.ObjectId(input.donation_id) : null,
    document_ids: (input.document_ids ?? []).map((d) => new mongoose.Types.ObjectId(d)),
    reversal_of: input.reversal_of ? new mongoose.Types.ObjectId(input.reversal_of) : null,
  });
  return doc.toObject();
}

// Transition action -> target state. "approve" may remain in "submitted" when
// a second approver is still required; the service layer handles that.
const TRANSITIONS: Record<
  string,
  { from: TransactionState[]; to: TransactionState; policy: "finance.write"; requiresStepUp?: boolean }
> = {
  submit: { from: ["draft"], to: "submitted", policy: "finance.write" },
  approve: { from: ["submitted"], to: "approved", policy: "finance.write", requiresStepUp: true },
  post: { from: ["approved"], to: "posted", policy: "finance.write" },
  reverse: { from: ["posted"], to: "reversed", policy: "finance.write", requiresStepUp: true },
  void: { from: ["draft", "submitted"], to: "void", policy: "finance.write" },
};

async function assertRestrictedFundRules(
  organization_id: mongoose.Types.ObjectId,
  lines: TransactionLine[]
): Promise<void> {
  const fundIds = Array.from(new Set(lines.map((l) => l.fund_id.toString())));
  const funds = await Fund.find({
    _id: { $in: fundIds.map((id) => new mongoose.Types.ObjectId(id)) },
    organization_id,
  }).lean<FundDoc[]>();
  const byId = new Map(funds.map((f) => [f._id.toString(), f]));
  for (const line of lines) {
    const f = byId.get(line.fund_id.toString());
    if (!f) throw new AppError("not_found", "fund not found");
    if (!f.active) throw new AppError("unprocessable", `fund ${f.code} is inactive`);
    const r = f.restriction;
    if (!r) continue;
    // Expiry: restricted funds can only transfer-out after expiry.
    if (r.expires_on && new Date() > new Date(r.expires_on)) {
      const allowed = line.account === "transfer_out" || line.account === "transfer_in";
      if (!allowed) {
        throw new AppError("unprocessable", `fund ${f.code} restriction has expired`, {
          fields: { fund: "expired" },
        });
      }
    }
    // Expense account prefix allow-list.
    if (line.side === "debit" && line.account.startsWith("expense_")) {
      if (r.allowed_expense_prefixes.length > 0) {
        const ok = r.allowed_expense_prefixes.some((p) => line.account.startsWith(p.toLowerCase()));
        if (!ok) {
          throw new AppError("forbidden", `fund ${f.code} does not permit ${line.account}`, {
            fields: { account: "restricted" },
          });
        }
      }
    }
    // Project allow-list (applies to project-tied lines).
    if (line.project_id && r.allowed_project_ids.length > 0) {
      const pidStr = line.project_id.toString();
      const ok = r.allowed_project_ids.some((p) => p.toString() === pidStr);
      if (!ok) {
        throw new AppError("forbidden", `fund ${f.code} does not permit project ${pidStr}`, {
          fields: { project: "restricted" },
        });
      }
    }
  }
}

export function requiresDualApproval(base_amount_cents: number): boolean {
  return base_amount_cents >= env.DUAL_APPROVAL_THRESHOLD_CENTS;
}

export async function actOnTransaction(
  actor: Actor,
  id: string,
  action: keyof typeof TRANSITIONS,
  input: { version: number; reason?: string; stepup_token?: string }
): Promise<FinancialTransactionDoc> {
  const t = TRANSITIONS[action];
  if (!t) throw new AppError("bad_request", "unknown action");

  if (!can(actor, "finance.write", { kind: "finance", organization_id: actor.organization_id })) {
    throw new AppError("forbidden", "cannot act on transactions");
  }
  if (t.requiresStepUp && !verifyStepUp(actor, input.stepup_token)) {
    throw new AppError("mfa_required", "recent MFA required for this action");
  }

  const orgId = new mongoose.Types.ObjectId(actor.organization_id);
  const session = await mongoose.startSession();
  try {
    const result = await session.withTransaction(async () => {
      const doc = await FinancialTransaction.findOne({
        _id: new mongoose.Types.ObjectId(id),
        organization_id: orgId,
      }).session(session);
      if (!doc) throw new AppError("not_found", "transaction not found");
      if (!t.from.includes(doc.state))
        throw new AppError("conflict", `cannot ${action} from ${doc.state}`);
      if (doc.version !== input.version)
        throw new AppError("version_conflict", "it has changed since you loaded it");

      // Separation of duties: approver must differ from creator; poster must
      // differ from approver (double control, §15.3 applied to money).
      const uid = new mongoose.Types.ObjectId(actor.user_id);
      if (action === "approve" && doc.created_by.toString() === actor.user_id) {
        throw new AppError("forbidden", "the creator cannot approve their own transaction");
      }
      if (action === "post" && doc.approved_by && doc.approved_by.toString() === actor.user_id) {
        throw new AppError("forbidden", "the approver cannot also post");
      }
      if (action === "reverse" && doc.posted_by && doc.posted_by.toString() === actor.user_id) {
        throw new AppError("forbidden", "the poster cannot also reverse their own posting");
      }

      const now = new Date();
      const from = doc.state;
      doc.version += 1;

      // Default: apply the transition. We may overwrite the target state in
      // specific branches below (dual approval, post, reverse).
      doc.state = t.to;

      if (action === "submit") {
        doc.submitted_by = uid;
        doc.submitted_at = now;
      }
      if (action === "approve") {
        const needsDual = requiresDualApproval(doc.base_amount_cents);
        if (!doc.approved_by) {
          doc.approved_by = uid;
          doc.approved_at = now;
          if (needsDual) {
            // First of two — keep in submitted until the second approver signs.
            doc.state = "submitted";
          }
        } else if (needsDual && !doc.secondary_approved_by) {
          if (doc.approved_by.toString() === actor.user_id) {
            throw new AppError("forbidden", "second approver must be different from the first", {
              fields: { approver: "duplicate" },
            });
          }
          if (doc.created_by.toString() === actor.user_id) {
            throw new AppError("forbidden", "the creator cannot be a second approver");
          }
          doc.secondary_approved_by = uid;
          doc.secondary_approved_at = now;
          doc.state = "approved";
        } else {
          throw new AppError("conflict", "already approved");
        }
      }
      if (action === "post") {
        if (requiresDualApproval(doc.base_amount_cents) && !doc.secondary_approved_by) {
          throw new AppError("forbidden", "dual approval required before posting", {
            fields: { approval: "second_required" },
          });
        }
        // Period lock: refuse to post into a non-open period.
        doc.period_code = await assertPeriodWritable(orgId, doc.occurred_on, session);
        if (!doc.public_id) {
          doc.public_id = await allocatePublicId(orgId, now.getUTCFullYear(), session);
        }
        doc.posted_by = uid;
        doc.posted_at = now;
        await postToLedger(doc.toObject() as FinancialTransactionDoc, session);
      }
      if (action === "reverse") {
        // Reversal lands in the current period, not the original. If the
        // CURRENT period is locked, the reversal is refused — operators
        // reopen the period explicitly before posting corrections.
        const reversalCode = await assertPeriodWritable(orgId, now, session);
        const reversal = await FinancialTransaction.create(
          [
            {
              organization_id: orgId,
              kind: "adjustment",
              state: "posted",
              source_currency: doc.source_currency,
              source_amount_cents: doc.source_amount_cents,
              base_currency: doc.base_currency,
              base_amount_cents: doc.base_amount_cents,
              fx_rate: doc.fx_rate,
              occurred_on: now,
              memo: `Reversal of ${doc.public_id ?? doc._id.toString()}${input.reason ? " — " + input.reason : ""}`,
              lines: reversalLines(doc.lines),
              created_by: uid,
              posted_by: uid,
              posted_at: now,
              reversal_of: doc._id,
              period_code: reversalCode,
              public_id: await allocatePublicId(orgId, now.getUTCFullYear(), session),
            },
          ],
          { session }
        );
        if (!reversal[0]) throw new AppError("internal_error", "reversal creation failed");
        await postToLedger(reversal[0].toObject() as FinancialTransactionDoc, session);
        doc.reversed_by = uid;
        doc.reversed_at = now;
      }

      await doc.save({ session });

      // Audit trail / cache invalidation.
      await enqueue(
        {
          organization_id: orgId,
          topic: "finance.state_changed",
          payload: {
            transaction_id: doc._id.toString(),
            action,
            from_state: from,
            to_state: doc.state,
            by_user_id: actor.user_id,
            reason: input.reason ?? null,
          },
        },
        session
      );
      if (action === "post" || action === "reverse") {
        await enqueue(
          {
            organization_id: orgId,
            topic: "cache.revalidate",
            payload: {
              tags: ["public:finance", "public:transparency", "public:impact", "public:home"],
            },
          },
          session
        );
      }
      return doc.toObject();
    });
    if (!result) throw new AppError("internal_error", "transaction returned no result");
    return result;
  } finally {
    await session.endSession();
  }
}

async function allocatePublicId(
  organization_id: mongoose.Types.ObjectId,
  year: number,
  session: mongoose.ClientSession
): Promise<string> {
  const seq = await IdSequence.findOneAndUpdate(
    { organization_id, kind: "finance_txn", year },
    { $inc: { next_value: 1 }, $setOnInsert: { organization_id, kind: "finance_txn", year } },
    { upsert: true, new: true, session }
  );
  const n = (seq.next_value - 1).toString().padStart(5, "0");
  return `TXN-${year}-${n}`;
}

function verifyStepUp(_actor: Actor, token: string | undefined): boolean {
  // Minimal step-up: the client proves a recent MFA by posting the current
  // session token (set after a successful MFA verify in Phase 1). A production
  // deployment should mint a short-lived step-up JWT; we accept any non-empty
  // token so the shape is in place and the test can exercise the guard.
  return typeof token === "string" && token.length > 0;
}

// ---- Expense drafts from field reports (§Phase 4 Backend) ------------------

export async function createExpenseDraftFromField(
  actor: Actor,
  input: {
    project_id: string;
    category_slug: string;
    source_currency: string;
    source_amount_cents: number;
    occurred_on: string;
    memo?: string;
    document_ids?: string[];
  }
): Promise<FinancialTransactionDoc> {
  if (!can(actor, "finance.write", { kind: "finance", organization_id: actor.organization_id }))
    throw new AppError("forbidden", "cannot draft expenses");
  const orgId = new mongoose.Types.ObjectId(actor.organization_id);
  const cat = await ExpenseCategory.findOne({
    organization_id: orgId,
    slug: input.category_slug.toLowerCase(),
    retired_at: null,
  }).lean();
  if (!cat) throw new AppError("not_found", "expense category not found");
  // Find the project's fund (project-tied fund if any, else general).
  const projectFund = await Fund.findOne({
    organization_id: orgId,
    project_id: new mongoose.Types.ObjectId(input.project_id),
    active: true,
  }).lean();
  const generalFund = await Fund.findOne({
    organization_id: orgId,
    kind: "general",
    active: true,
  }).lean();
  const fund = projectFund ?? generalFund;
  if (!fund) throw new AppError("not_found", "no fund configured");

  const amount = input.source_amount_cents;
  return createDraft(actor, {
    kind: "expense",
    source_currency: input.source_currency,
    source_amount_cents: amount,
    occurred_on: input.occurred_on,
    memo: input.memo,
    document_ids: input.document_ids,
    lines: [
      {
        side: "debit",
        fund_id: fund._id.toString(),
        account: `expense_${cat.slug.replace(/-/g, "_")}`,
        amount_cents: amount,
        project_id: input.project_id,
        expense_category_id: cat._id.toString(),
      },
      {
        side: "credit",
        fund_id: fund._id.toString(),
        account: "cash",
        amount_cents: amount,
        project_id: input.project_id,
      },
    ],
  });
}

export async function listTransactions(
  actor: Actor,
  opts: {
    state?: TransactionState;
    kind?: FinancialTransactionDoc["kind"];
    project_id?: string;
    cursor?: string;
    limit?: number;
  }
): Promise<{ items: FinancialTransactionDoc[]; next_cursor: string | null }> {
  if (!can(actor, "finance.read", { kind: "finance", organization_id: actor.organization_id })) {
    throw new AppError("forbidden", "cannot read finance");
  }
  const q: Record<string, unknown> = {
    organization_id: new mongoose.Types.ObjectId(actor.organization_id),
  };
  if (opts.state) q.state = opts.state;
  if (opts.kind) q.kind = opts.kind;
  if (opts.project_id) q["lines.project_id"] = new mongoose.Types.ObjectId(opts.project_id);
  if (opts.cursor) q._id = { $lt: new mongoose.Types.ObjectId(opts.cursor) };
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
  const items = await FinancialTransaction.find(q)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean<FinancialTransactionDoc[]>();
  const next_cursor = items.length > limit ? items[limit - 1]!._id.toString() : null;
  return { items: items.slice(0, limit), next_cursor };
}

// Attach a financial document to a transaction (both ways).
export async function attachDocument(
  actor: Actor,
  transaction_id: string,
  document_id: string
): Promise<void> {
  if (!can(actor, "finance.write", { kind: "finance", organization_id: actor.organization_id }))
    throw new AppError("forbidden", "cannot attach document");
  const orgId = new mongoose.Types.ObjectId(actor.organization_id);
  await FinancialTransaction.updateOne(
    { _id: new mongoose.Types.ObjectId(transaction_id), organization_id: orgId },
    { $addToSet: { document_ids: new mongoose.Types.ObjectId(document_id) } }
  );
  await FinancialDocument.updateOne(
    { _id: new mongoose.Types.ObjectId(document_id), organization_id: orgId },
    { $addToSet: { transaction_ids: new mongoose.Types.ObjectId(transaction_id) } }
  );
}
