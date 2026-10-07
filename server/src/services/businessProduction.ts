import mongoose from "mongoose";
import { AppError } from "@/util/errors.js";
import {
  Business,
  BusinessProduction,
  FinancialTransaction,
  IdSequence,
  Fund,
} from "@/models/index.js";
import type { ProductionUnit } from "@/models/BusinessProduction.js";
import type { Actor } from "@/policy/index.js";
import { can } from "@/policy/index.js";
import { writeAudit } from "./audit.js";
import { enqueue } from "./outbox.js";
import { convertToBase } from "./fx.js";
import { postToLedger } from "./ledger.js";
import type { RequestCtx } from "./users.js";
import { env } from "@/config/env.js";

// =============================================================================
// Business production submit → approve → post. Separation of duties: the
// submitter cannot be the approver. On approve, we post a balanced
// FinancialTransaction (DR cash, CR revenue_business) and link the production
// row to the posted transaction. The ledger_entries get business_id so the
// sustainability aggregator can walk by business dimension.
// =============================================================================

function toObjectId(id: string, field: string): mongoose.Types.ObjectId {
  if (!mongoose.isValidObjectId(id)) throw new AppError("bad_request", `invalid ${field}`);
  return new mongoose.Types.ObjectId(id);
}

export type ProductionInput = {
  business_id: string;
  caption: string;
  quantity: number;
  unit: ProductionUnit;
  source_currency: string;
  gross_source_cents: number;
  occurred_on: Date;
  idempotency_key?: string | null;
};

export async function submitProduction(
  actor: Actor,
  input: ProductionInput,
  ctx: RequestCtx
): Promise<{ id: string }> {
  if (!can(actor, "business_production.submit")) throw new AppError("forbidden", "forbidden");
  const org_id = toObjectId(actor.organization_id, "organization_id");
  const actor_id = toObjectId(actor.user_id, "actor");
  const biz_id = toObjectId(input.business_id, "business_id");

  if (!Number.isFinite(input.gross_source_cents) || input.gross_source_cents < 1) {
    throw new AppError("bad_request", "gross must be at least one cent");
  }
  if (!Number.isFinite(input.quantity) || input.quantity < 0) {
    throw new AppError("bad_request", "quantity must be non-negative");
  }

  const biz = await Business.findOne({ _id: biz_id, organization_id: org_id }).lean();
  if (!biz) throw new AppError("not_found", "business not found");
  if (biz.status === "retired") throw new AppError("conflict", "business is retired");

  // FX convert the gross outside the txn (no DB write needed).
  const { base_cents, rate } = await convertToBase(
    org_id,
    input.gross_source_cents,
    input.source_currency,
    input.occurred_on
  );

  const session = await mongoose.startSession();
  try {
    let id!: mongoose.Types.ObjectId;
    await session.withTransaction(async () => {
      // Idempotency (§10.2).
      if (input.idempotency_key) {
        const existing = await BusinessProduction.findOne({
          submitted_by: actor_id,
          idempotency_key: input.idempotency_key,
        }).session(session);
        if (existing) {
          id = existing._id;
          return;
        }
      }
      const [doc] = await BusinessProduction.create(
        [
          {
            organization_id: org_id,
            business_id: biz_id,
            community_id: biz.community_id,
            caption: input.caption.slice(0, 500),
            quantity: input.quantity,
            unit: input.unit,
            source_currency: input.source_currency.toUpperCase(),
            gross_source_cents: input.gross_source_cents,
            gross_base_cents: base_cents,
            fx_rate: rate,
            occurred_on: input.occurred_on,
            state: "submitted",
            submitted_by: actor_id,
            submitted_at: new Date(),
            idempotency_key: input.idempotency_key ?? null,
          },
        ],
        { session }
      );
      id = doc._id;

      await writeAudit(
        {
          organization_id: org_id,
          actor_id,
          actor_role: null,
          action: "business_production.submit",
          entity_type: "business_production",
          entity_id: id,
          after: {
            business_id: biz_id.toString(),
            quantity: input.quantity,
            unit: input.unit,
            gross_source_cents: input.gross_source_cents,
            source_currency: input.source_currency.toUpperCase(),
          },
          ip: ctx.ip,
          user_agent: ctx.user_agent,
          request_id: ctx.request_id,
        },
        session
      );
    });
    return { id: id.toString() };
  } finally {
    await session.endSession();
  }
}

export async function approveProduction(
  actor: Actor,
  id: string,
  ctx: RequestCtx
): Promise<{ transaction_id: string; public_id: string }> {
  if (!can(actor, "business_production.approve")) throw new AppError("forbidden", "forbidden");
  const org_id = toObjectId(actor.organization_id, "organization_id");
  const actor_id = toObjectId(actor.user_id, "actor");
  const prod_id = toObjectId(id, "production_id");

  const session = await mongoose.startSession();
  try {
    let out!: { transaction_id: string; public_id: string };
    await session.withTransaction(async () => {
      const prod = await BusinessProduction.findOne({
        _id: prod_id,
        organization_id: org_id,
      }).session(session);
      if (!prod) throw new AppError("not_found", "production not found");
      if (prod.state !== "submitted") {
        throw new AppError("conflict", `cannot approve from state ${prod.state}`);
      }
      // Separation of duties — submitter ≠ approver.
      if (prod.submitted_by.equals(actor_id)) {
        throw new AppError("forbidden", "approver must differ from submitter");
      }

      const biz = await Business.findOne({ _id: prod.business_id, organization_id: org_id }).session(session);
      if (!biz) throw new AppError("not_found", "business missing");

      // Pick a fund — business.fund_id if set, else the organization's general.
      let fund_id = biz.fund_id;
      if (!fund_id) {
        const general = await Fund.findOne({ organization_id: org_id, code: "GEN" }).session(session);
        if (!general) throw new AppError("unavailable", "no general fund configured");
        fund_id = general._id;
      }

      // Allocate a public id and post a balanced transaction:
      //   DR cash  <gross>
      //   CR revenue_business  <gross>
      const year = prod.occurred_on.getUTCFullYear();
      const seq = await IdSequence.findOneAndUpdate(
        { organization_id: org_id, kind: "finance_txn", year },
        { $inc: { next_value: 1 }, $setOnInsert: { organization_id: org_id, kind: "finance_txn", year } },
        { upsert: true, new: true, session }
      );
      const public_id = `TXN-${year}-${(seq.next_value - 1).toString().padStart(5, "0")}`;

      const [txn] = await FinancialTransaction.create(
        [
          {
            organization_id: org_id,
            public_id,
            kind: "adjustment",
            state: "approved",
            source_currency: prod.source_currency,
            source_amount_cents: prod.gross_source_cents,
            base_currency: env.BASE_CURRENCY.toUpperCase(),
            base_amount_cents: prod.gross_base_cents,
            fx_rate: prod.fx_rate,
            occurred_on: prod.occurred_on,
            memo: `Business production: ${biz.name} — ${prod.caption}`.slice(0, 2000),
            lines: [
              {
                side: "debit",
                fund_id,
                account: "cash",
                amount_cents: prod.gross_base_cents,
                memo: null,
                project_id: null,
                expense_category_id: null,
                business_id: biz._id,
              },
              {
                side: "credit",
                fund_id,
                account: "revenue_business",
                amount_cents: prod.gross_base_cents,
                memo: null,
                project_id: null,
                expense_category_id: null,
                business_id: biz._id,
              },
            ],
            created_by: prod.submitted_by,
            submitted_by: prod.submitted_by,
            submitted_at: prod.submitted_at,
            approved_by: actor_id,
            approved_at: new Date(),
            posted_by: actor_id,
            posted_at: new Date(),
          },
        ],
        { session }
      );

      await postToLedger(txn, session);

      // Flip transaction state to posted and bind the production row to it.
      txn.state = "posted";
      await txn.save({ session });

      prod.state = "posted";
      prod.approved_by = actor_id;
      prod.approved_at = new Date();
      prod.posted_at = new Date();
      prod.transaction_id = txn._id;
      prod.version += 1;
      await prod.save({ session });

      await writeAudit(
        {
          organization_id: org_id,
          actor_id,
          actor_role: null,
          action: "business_production.approve",
          entity_type: "business_production",
          entity_id: prod._id,
          after: { transaction_id: txn._id.toString(), public_id },
          ip: ctx.ip,
          user_agent: ctx.user_agent,
          request_id: ctx.request_id,
        },
        session
      );

      await enqueue(
        {
          organization_id: org_id,
          topic: "cache.revalidate",
          payload: { tags: ["public:sustainability", "public:businesses", `public:business:${biz.slug}`] },
        },
        session
      );

      out = { transaction_id: txn._id.toString(), public_id };
    });
    return out;
  } finally {
    await session.endSession();
  }
}

export async function rejectProduction(
  actor: Actor,
  id: string,
  reason: string,
  ctx: RequestCtx
): Promise<void> {
  if (!can(actor, "business_production.approve")) throw new AppError("forbidden", "forbidden");
  const org_id = toObjectId(actor.organization_id, "organization_id");
  const actor_id = toObjectId(actor.user_id, "actor");
  const prod_id = toObjectId(id, "production_id");

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const prod = await BusinessProduction.findOne({
        _id: prod_id,
        organization_id: org_id,
      }).session(session);
      if (!prod) throw new AppError("not_found", "production not found");
      if (prod.state !== "submitted") throw new AppError("conflict", "not submitted");
      if (prod.submitted_by.equals(actor_id)) {
        throw new AppError("forbidden", "rejecter must differ from submitter");
      }
      prod.state = "rejected";
      prod.rejected_reason = reason.slice(0, 1000);
      prod.version += 1;
      await prod.save({ session });

      await writeAudit(
        {
          organization_id: org_id,
          actor_id,
          actor_role: null,
          action: "business_production.reject",
          entity_type: "business_production",
          entity_id: prod._id,
          after: { reason },
          ip: ctx.ip,
          user_agent: ctx.user_agent,
          request_id: ctx.request_id,
        },
        session
      );
    });
  } finally {
    await session.endSession();
  }
}

export async function listProduction(
  actor: Actor,
  opts: {
    business_id?: string | null;
    state?: string | null;
    after?: string | null;
    limit?: number;
  }
): Promise<{ items: Array<Record<string, unknown>>; next: string | null }> {
  if (!can(actor, "businesses.read")) throw new AppError("forbidden", "forbidden");
  const org_id = toObjectId(actor.organization_id, "organization_id");
  const limit = Math.min(100, opts.limit ?? 25);
  const q: Record<string, unknown> = { organization_id: org_id };
  if (opts.business_id && mongoose.isValidObjectId(opts.business_id)) {
    q.business_id = new mongoose.Types.ObjectId(opts.business_id);
  }
  if (opts.state) q.state = opts.state;
  if (opts.after && mongoose.isValidObjectId(opts.after)) {
    q._id = { $lt: new mongoose.Types.ObjectId(opts.after) };
  }
  const rows = await BusinessProduction.find(q).sort({ _id: -1 }).limit(limit).lean();
  return {
    items: rows.map((p) => ({
      id: p._id.toString(),
      business_id: p.business_id.toString(),
      caption: p.caption,
      quantity: p.quantity,
      unit: p.unit,
      source_currency: p.source_currency,
      gross_source_cents: p.gross_source_cents,
      gross_base_cents: p.gross_base_cents,
      fx_rate: p.fx_rate,
      occurred_on: p.occurred_on,
      state: p.state,
      submitted_by: p.submitted_by.toString(),
      approved_by: p.approved_by ? p.approved_by.toString() : null,
      transaction_id: p.transaction_id ? p.transaction_id.toString() : null,
    })),
    next: rows.length === limit && rows.length > 0 ? rows[rows.length - 1]!._id.toString() : null,
  };
}
