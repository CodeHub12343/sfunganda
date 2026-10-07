import { createHash } from "node:crypto";
import mongoose from "mongoose";
import {
  Fund,
  InterOrgTransfer,
  LedgerEntry,
  Organization,
  type InterOrgTransferDoc,
} from "@/models/index.js";
import { AppError } from "@/util/errors.js";
import { can, type Actor } from "@/policy/index.js";
import { env } from "@/config/env.js";

// =============================================================================
// "Pay it forward" (§13). Moves `amount_cents` from one org's fund to
// another's. Both sides must have consented; the sender must be a
// founder; the amount posts as two ledger entries wired via the
// `InterOrgTransfer` row's _id (the cross-reference). The two orgs'
// hash chains stay independent — no shared seed.
// =============================================================================

export type InitiateInput = {
  to_organization_slug: string;
  from_fund_id: string;
  // Receiving fund — selected by the SENDER from a list of the
  // recipient's unrestricted funds; the recipient has opted in by
  // enabling `inter_org.receive_enabled`.
  to_fund_id: string;
  amount_cents: number;
  currency: string;
  memo?: string;
  idempotency_key: string;
};

function hashChainEntry(args: {
  seq: number;
  prev_hash: string;
  tx_id: string;
  side: "debit" | "credit";
  fund_id: string;
  account: string;
  amount_cents: number;
  base_currency: string;
  posted_at_ms: number;
}): string {
  const seed = createHash("sha256")
    .update(env.LEDGER_HASH_SEED + ":interorg")
    .digest("hex");
  return createHash("sha256")
    .update(
      seed +
        "|" +
        args.prev_hash +
        "|" +
        JSON.stringify({
          seq: args.seq,
          tx: args.tx_id,
          side: args.side,
          fund: args.fund_id,
          account: args.account,
          amount: args.amount_cents,
          currency: args.base_currency,
          posted_at: args.posted_at_ms,
        })
    )
    .digest("hex");
}

async function nextSeqAndPrev(
  organization_id: mongoose.Types.ObjectId,
  session: mongoose.ClientSession
): Promise<{ seq: number; prev_hash: string }> {
  const row = await LedgerEntry.findOne({ organization_id })
    .sort({ seq: -1 })
    .session(session)
    .lean();
  return { seq: row ? row.seq + 1 : 1, prev_hash: row ? row.hash : "" };
}

export async function initiateTransfer(
  actor: Actor,
  input: InitiateInput
): Promise<{ id: string; state: "posted" | "pending" }> {
  if (!can(actor, "organization.transfer_send"))
    throw new AppError("forbidden", "cannot initiate inter-org transfers");
  if (!Number.isInteger(input.amount_cents) || input.amount_cents <= 0) {
    throw new AppError("bad_request", "amount_cents must be a positive integer");
  }

  const fromOrgId = new mongoose.Types.ObjectId(actor.organization_id);
  const toOrg = await Organization.findOne({ slug: input.to_organization_slug.toLowerCase() }).lean();
  if (!toOrg) throw new AppError("not_found", "recipient organisation not found");
  if (toOrg._id.equals(fromOrgId)) {
    throw new AppError("bad_request", "cannot transfer to the same organisation");
  }

  const fromOrg = await Organization.findById(fromOrgId).lean();
  if (!fromOrg) throw new AppError("not_found", "organisation missing");
  if (!fromOrg.inter_org.send_enabled) {
    throw new AppError("conflict", "this organisation has not enabled inter-org sending");
  }
  if (!toOrg.inter_org.receive_enabled) {
    throw new AppError("conflict", "the recipient organisation does not accept transfers");
  }
  if (
    toOrg.inter_org.allowed_recipient_slugs.length > 0 &&
    !toOrg.inter_org.allowed_recipient_slugs.includes(fromOrg.slug)
  ) {
    throw new AppError("forbidden", "the recipient has not approved transfers from this organisation");
  }

  const fromFund = await Fund.findOne({
    _id: new mongoose.Types.ObjectId(input.from_fund_id),
    organization_id: fromOrgId,
    active: true,
  }).lean();
  if (!fromFund) throw new AppError("not_found", "source fund not found");
  if (fromFund.kind === "restricted" || fromFund.kind === "endowment") {
    throw new AppError("conflict", "restricted or endowed funds cannot be transferred");
  }
  if (fromFund.balance_cents < input.amount_cents) {
    throw new AppError("conflict", "insufficient balance");
  }

  const toFund = await Fund.findOne({
    _id: new mongoose.Types.ObjectId(input.to_fund_id),
    organization_id: toOrg._id,
    active: true,
  }).lean();
  if (!toFund) throw new AppError("not_found", "destination fund not found");
  if (toFund.kind === "restricted" || toFund.kind === "endowment") {
    throw new AppError("conflict", "cannot deposit into a restricted or endowed fund");
  }
  if (fromFund.base_currency !== toFund.base_currency) {
    throw new AppError(
      "conflict",
      "currencies differ; convert on the sender side before transferring"
    );
  }

  // Allocate the application row first so a replay returns the same id.
  let row: InterOrgTransferDoc;
  try {
    row = (await InterOrgTransfer.create({
      from_organization_id: fromOrgId,
      to_organization_id: toOrg._id,
      from_fund_id: fromFund._id,
      to_fund_id: toFund._id,
      amount_cents: input.amount_cents,
      currency: input.currency.toUpperCase(),
      state: "pending",
      memo: input.memo ?? null,
      idempotency_key: input.idempotency_key,
      initiated_by: new mongoose.Types.ObjectId(actor.user_id),
      initiated_at: new Date(),
    })) as unknown as InterOrgTransferDoc;
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      const existing = await InterOrgTransfer.findOne({
        from_organization_id: fromOrgId,
        idempotency_key: input.idempotency_key,
      }).lean();
      if (existing) {
        return {
          id: existing._id.toString(),
          state: existing.state === "posted" ? "posted" : "pending",
        };
      }
    }
    throw err;
  }

  // Post the two ledger entries in one Mongo transaction. Each side's
  // seq+prev_hash is calculated independently against its own
  // organisation's chain tip; the application row holds the two entry
  // ids for cross-reference.
  const session = await mongoose.startSession();
  try {
    const result = await session.withTransaction(async () => {
      const now = new Date();
      const nowMs = now.getTime();

      const fromChain = await nextSeqAndPrev(fromOrgId, session);
      const fromHash = hashChainEntry({
        seq: fromChain.seq,
        prev_hash: fromChain.prev_hash,
        tx_id: row._id.toString(),
        side: "debit",
        fund_id: fromFund._id.toString(),
        account: "transfer_out_interorg",
        amount_cents: input.amount_cents,
        base_currency: fromFund.base_currency,
        posted_at_ms: nowMs,
      });
      const [fromEntry] = await LedgerEntry.create(
        [
          {
            organization_id: fromOrgId,
            transaction_id: row._id,
            seq: fromChain.seq,
            prev_hash: fromChain.prev_hash,
            hash: fromHash,
            side: "debit",
            fund_id: fromFund._id,
            account: "transfer_out_interorg",
            amount_cents: input.amount_cents,
            base_currency: fromFund.base_currency,
            posted_at: now,
            project_id: null,
            expense_category_id: null,
          },
        ],
        { session }
      );

      const toChain = await nextSeqAndPrev(toOrg._id, session);
      const toHash = hashChainEntry({
        seq: toChain.seq,
        prev_hash: toChain.prev_hash,
        tx_id: row._id.toString(),
        side: "credit",
        fund_id: toFund._id.toString(),
        account: "transfer_in_interorg",
        amount_cents: input.amount_cents,
        base_currency: toFund.base_currency,
        posted_at_ms: nowMs,
      });
      const [toEntry] = await LedgerEntry.create(
        [
          {
            organization_id: toOrg._id,
            transaction_id: row._id,
            seq: toChain.seq,
            prev_hash: toChain.prev_hash,
            hash: toHash,
            side: "credit",
            fund_id: toFund._id,
            account: "transfer_in_interorg",
            amount_cents: input.amount_cents,
            base_currency: toFund.base_currency,
            posted_at: now,
            project_id: null,
            expense_category_id: null,
          },
        ],
        { session }
      );

      // Update denormalised balances.
      await Fund.updateOne(
        { _id: fromFund._id },
        {
          $inc: {
            balance_cents: -input.amount_cents,
            total_out_cents: input.amount_cents,
          },
        },
        { session }
      );
      await Fund.updateOne(
        { _id: toFund._id },
        {
          $inc: {
            balance_cents: input.amount_cents,
            total_in_cents: input.amount_cents,
          },
        },
        { session }
      );

      // Promote the application row.
      await InterOrgTransfer.updateOne(
        { _id: row._id },
        {
          $set: {
            state: "posted",
            posted_at: now,
            from_ledger_entry_id: fromEntry!._id,
            to_ledger_entry_id: toEntry!._id,
          },
        },
        { session }
      );
    });
    void result;
    return { id: row._id.toString(), state: "posted" };
  } catch (err) {
    await InterOrgTransfer.updateOne(
      { _id: row._id },
      {
        $set: {
          state: "failed",
          failure_reason: (err as Error).message?.slice(0, 500) ?? "unknown",
        },
      }
    );
    throw err;
  } finally {
    await session.endSession();
  }
}

export async function listTransfers(actor: Actor): Promise<InterOrgTransferDoc[]> {
  if (!can(actor, "organization.manage")) throw new AppError("forbidden", "cannot read transfers");
  const orgId = new mongoose.Types.ObjectId(actor.organization_id);
  return InterOrgTransfer.find({
    $or: [{ from_organization_id: orgId }, { to_organization_id: orgId }],
  })
    .sort({ created_at: -1 })
    .limit(100)
    .lean<InterOrgTransferDoc[]>();
}

export async function listReceiverOptions(
  actor: Actor
): Promise<Array<{ slug: string; name: string; funds: Array<{ id: string; code: string; name: string; base_currency: string }> }>> {
  if (!can(actor, "organization.transfer_send")) throw new AppError("forbidden", "cannot read");
  const fromOrgId = new mongoose.Types.ObjectId(actor.organization_id);
  const fromOrg = await Organization.findById(fromOrgId).lean();
  if (!fromOrg || !fromOrg.inter_org.send_enabled) return [];
  const receivers = await Organization.find({
    _id: { $ne: fromOrgId },
    "inter_org.receive_enabled": true,
    $or: [
      { "inter_org.allowed_recipient_slugs": { $size: 0 } },
      { "inter_org.allowed_recipient_slugs": fromOrg.slug },
    ],
  }).lean();
  const out: Array<{ slug: string; name: string; funds: Array<{ id: string; code: string; name: string; base_currency: string }> }> = [];
  for (const r of receivers) {
    const funds = await Fund.find(
      {
        organization_id: r._id,
        active: true,
        kind: { $in: ["general", "project"] },
      },
      { code: 1, name: 1, base_currency: 1 }
    ).lean();
    out.push({
      slug: r.slug,
      name: r.name,
      funds: funds.map((f) => ({
        id: f._id.toString(),
        code: f.code,
        name: f.name,
        base_currency: f.base_currency,
      })),
    });
  }
  return out;
}
