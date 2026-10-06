import { createHmac, timingSafeEqual } from "node:crypto";
import mongoose from "mongoose";
import {
  Donation,
  FinancialTransaction,
  Fund,
  IdSequence,
  Organization,
  Project,
  StripeEvent,
  User,
} from "@/models/index.js";
import { AppError } from "@/util/errors.js";
import { env } from "@/config/env.js";
import { log } from "@/util/log.js";
import { postToLedger, reversalLines } from "./ledger.js";

// Stripe sends `Stripe-Signature: t=<ts>,v1=<hex>` (and sometimes other
// schemes). We verify v1 only, with a 5-minute replay window.
export function verifyStripeSignature(rawBody: string, header: string | undefined): boolean {
  if (!env.STRIPE_WEBHOOK_SECRET || !header) return false;
  const parts: Record<string, string> = {};
  for (const seg of header.split(",")) {
    const [k, v] = seg.trim().split("=");
    if (k && v) parts[k] = v;
  }
  const t = parts.t;
  const sig = parts.v1;
  if (!t || !sig) return false;
  const skew = Math.abs(Math.floor(Date.now() / 1000) - Number(t));
  if (!Number.isFinite(skew) || skew > 300) return false;
  const expected = createHmac("sha256", env.STRIPE_WEBHOOK_SECRET)
    .update(`${t}.${rawBody}`)
    .digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(sig, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type StripeEventPayload = {
  id: string;
  type: string;
  livemode: boolean;
  created: number;
  data: { object: Record<string, unknown> };
};

// Entry point from the webhook route. Idempotent: a replay returns the
// same (ignored) outcome without side effects.
export async function ingestStripeEvent(payload: unknown): Promise<{
  outcome: "processed" | "ignored" | "error";
  message?: string;
}> {
  const ev = payload as StripeEventPayload;
  if (!ev?.id || !ev?.type) throw new AppError("bad_request", "malformed event");

  // Single-tenant: scope to the primary organization. A multi-org deployment
  // would key off the Stripe account id reported in the event.
  const org = await Organization.findOne().sort({ _id: 1 }).lean();
  if (!org) {
    log.warn({ event_id: ev.id }, "stripe.no_org");
    return { outcome: "ignored", message: "no organization" };
  }
  const orgId = org._id;

  // Idempotency: unique on (organization_id, stripe_event_id). If this row
  // already exists AND is processed, we skip. Otherwise we claim it with
  // outcome=pending and continue.
  try {
    await StripeEvent.create({
      organization_id: orgId,
      stripe_event_id: ev.id,
      type: ev.type,
      livemode: !!ev.livemode,
      received_at: new Date(),
      outcome: "pending",
      payload: ev,
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      const existing = await StripeEvent.findOne({
        organization_id: orgId,
        stripe_event_id: ev.id,
      }).lean();
      if (existing?.outcome === "processed" || existing?.outcome === "ignored") {
        return { outcome: existing.outcome, message: "replay suppressed" };
      }
      // Pending or error — fall through to try processing again.
    } else {
      throw err;
    }
  }

  try {
    const outcome = await route(ev, orgId);
    await StripeEvent.updateOne(
      { organization_id: orgId, stripe_event_id: ev.id },
      { $set: { outcome, processed_at: new Date(), error_message: null } }
    );
    return { outcome };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    await StripeEvent.updateOne(
      { organization_id: orgId, stripe_event_id: ev.id },
      { $set: { outcome: "error", error_message: msg } }
    );
    log.error({ event_id: ev.id, err: msg }, "stripe.ingest.failed");
    return { outcome: "error", message: msg };
  }
}

async function route(
  ev: StripeEventPayload,
  orgId: mongoose.Types.ObjectId
): Promise<"processed" | "ignored"> {
  switch (ev.type) {
    case "checkout.session.completed":
    case "charge.succeeded":
    case "payment_intent.succeeded":
      await handleCharge(ev, orgId);
      return "processed";
    case "charge.refunded":
    case "charge.refund.updated":
      await handleRefund(ev, orgId);
      return "processed";
    case "charge.dispute.created":
    case "charge.dispute.closed":
      await handleDispute(ev, orgId);
      return "processed";
    default:
      return "ignored";
  }
}

type ChargeLike = {
  id?: string;
  payment_intent?: string;
  amount?: number;
  amount_captured?: number;
  currency?: string;
  balance_transaction?: string | { id?: string; fee?: number; net?: number; exchange_rate?: number };
  billing_details?: { email?: string | null; name?: string | null };
  metadata?: Record<string, string>;
  customer?: string | null;
  livemode?: boolean;
  created?: number;
};

// Shared handling for checkout.session.completed, charge.succeeded, and
// payment_intent.succeeded — all converge on a Charge-like object. Uses
// uniqueness on stripe_charge_id to make the four sibling events idempotent.
async function handleCharge(ev: StripeEventPayload, orgId: mongoose.Types.ObjectId): Promise<void> {
  const obj = ev.data.object as ChargeLike & { payment_intent?: string };
  const charge_id = obj.id;
  const pi_id = typeof obj.payment_intent === "string" ? obj.payment_intent : null;
  if (!charge_id && !pi_id) return;

  const amount = Number(obj.amount_captured ?? obj.amount ?? 0);
  if (amount <= 0) return;
  const source_currency = String(obj.currency ?? "usd").toUpperCase();

  // Fee / net extraction. Stripe reports fees on the balance_transaction;
  // when inline, we have both numbers directly.
  const bt = obj.balance_transaction;
  let fee = 0;
  let net = amount;
  let fx_rate = 1;
  if (bt && typeof bt === "object") {
    fee = Math.round(Number(bt.fee ?? 0));
    net = Math.round(Number(bt.net ?? amount - fee));
    fx_rate = Number(bt.exchange_rate ?? 1);
  }
  const base_currency = env.BASE_CURRENCY.toUpperCase();
  const gross_base = source_currency === base_currency ? amount : Math.round(amount * fx_rate);
  const fee_base = source_currency === base_currency ? fee : Math.round(fee * fx_rate);
  const net_base = source_currency === base_currency ? net : Math.round(net * fx_rate);

  // Project designation from Checkout metadata (public donate flow sets it).
  const project_slug = obj.metadata?.project_slug ?? null;
  let project_id: mongoose.Types.ObjectId | null = null;
  let fund = await Fund.findOne({ organization_id: orgId, kind: "general", active: true });
  if (project_slug) {
    const p = await Project.findOne({ organization_id: orgId, slug: project_slug }).lean();
    if (p) {
      project_id = p._id;
      const projectFund = await Fund.findOne({
        organization_id: orgId,
        project_id: p._id,
        active: true,
      });
      if (projectFund) fund = projectFund;
    }
  }
  if (!fund) {
    log.warn({ orgId: orgId.toString() }, "stripe.no_general_fund");
    return;
  }

  // Normalize donor email once so every downstream query (dashboard
  // lookup, signup backfill, auto-link below) compares apples to apples.
  const rawEmail = obj.billing_details?.email ?? null;
  const normalizedEmail = rawEmail ? rawEmail.trim().toLowerCase() : null;

  // Resolve supporter link. Metadata set by the signed-in donate route
  // wins — it was authenticated by a session cookie. We still validate
  // the user exists in this organization before trusting it. Fall back
  // to a case-insensitive lookup by the normalized billing email so a
  // donation made after signup still lands in the right dashboard.
  const metaSupporterId = obj.metadata?.supporter_user_id ?? null;
  let supporterUserId: mongoose.Types.ObjectId | null = null;
  if (metaSupporterId && mongoose.isValidObjectId(metaSupporterId)) {
    const u = await User.findOne({
      _id: new mongoose.Types.ObjectId(metaSupporterId),
      organization_id: orgId,
      status: "active",
    })
      .select({ _id: 1 })
      .lean();
    if (u) supporterUserId = u._id;
  }
  if (!supporterUserId && normalizedEmail) {
    const u = await User.findOne({
      organization_id: orgId,
      email: normalizedEmail,
      email_verified_at: { $ne: null },
    })
      .select({ _id: 1 })
      .lean();
    if (u) supporterUserId = u._id;
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Donation row — unique on stripe_charge_id when present.
      let donation = charge_id
        ? await Donation.findOne({ stripe_charge_id: charge_id }).session(session)
        : pi_id
          ? await Donation.findOne({ stripe_payment_intent_id: pi_id }).session(session)
          : null;
      if (!donation) {
        const pubId = await allocatePublic(orgId, "donation", session);
        [donation] = await Donation.create(
          [
            {
              organization_id: orgId,
              public_id: pubId,
              donor_name: obj.billing_details?.name ?? null,
              donor_email: normalizedEmail,
              supporter_user_id: supporterUserId,
              anonymous: obj.metadata?.anonymous === "true",
              project_id,
              fund_id: fund!._id,
              source_currency,
              gross_source_cents: amount,
              fee_source_cents: fee,
              net_source_cents: net,
              base_currency,
              gross_base_cents: gross_base,
              fee_base_cents: fee_base,
              net_base_cents: net_base,
              fx_rate,
              processor: "stripe",
              stripe_charge_id: charge_id ?? null,
              stripe_payment_intent_id: pi_id,
              stripe_customer_id: typeof obj.customer === "string" ? obj.customer : null,
              recurring: obj.metadata?.recurring === "true",
              status: "succeeded",
              received_at: obj.created ? new Date(obj.created * 1000) : new Date(),
            },
          ],
          { session }
        );
      } else {
        donation.status = "succeeded";
        // Backfill the supporter link on replay if we didn't know it the
        // first time (e.g. a later signup created the matching user).
        if (!donation.supporter_user_id && supporterUserId) {
          donation.supporter_user_id = supporterUserId;
        }
        await donation.save({ session });
      }
      if (!donation) throw new AppError("internal_error", "donation upsert failed");

      // If this donation already has a posted transaction, we're done.
      if (donation.transaction_id) return;

      // Build the double-entry transaction and post it.
      const txPublicId = await allocatePublic(orgId, "finance_txn", session);
      const [txn] = await FinancialTransaction.create(
        [
          {
            organization_id: orgId,
            public_id: txPublicId,
            kind: "donation",
            state: "posted",
            source_currency,
            source_amount_cents: amount,
            base_currency,
            base_amount_cents: gross_base,
            fx_rate: source_currency === base_currency ? null : fx_rate,
            occurred_on: donation.received_at,
            memo: `Donation ${donation.public_id}`,
            created_by: donation._id, // system-created, no human; use donation id as a stable creator marker
            posted_by: donation._id,
            posted_at: new Date(),
            stripe_charge_id: charge_id ?? null,
            stripe_payment_intent_id: pi_id,
            donation_id: donation._id,
            lines: [
              {
                side: "debit",
                fund_id: fund!._id,
                account: "stripe_clearing",
                amount_cents: net_base,
                project_id,
                memo: "Net of fees",
              },
              {
                side: "debit",
                fund_id: fund!._id,
                account: "payment_fees",
                amount_cents: fee_base,
                project_id,
                memo: "Stripe fee",
              },
              {
                side: "credit",
                fund_id: fund!._id,
                account: "donations_received",
                amount_cents: gross_base,
                project_id,
                memo: `Donation ${donation.public_id}`,
              },
            ],
          },
        ],
        { session }
      );
      if (!txn) throw new AppError("internal_error", "transaction creation failed");
      await postToLedger(txn.toObject(), session);
      donation.transaction_id = txn._id;
      await donation.save({ session });

      // Receipt: queue an acknowledgement to the donor's email (where
      // present). Idempotent via EmailDelivery's unique key.
      if (donation.donor_email) {
        const { enqueue } = await import("./outbox.js");
        await enqueue(
          {
            organization_id: orgId,
            topic: "email.send_template",
            payload: {
              template: "donation_receipt",
              to: donation.donor_email,
              user_id: null,
              idempotency_key: `receipt-${donation.public_id}`,
              data: {
                donor_name: donation.donor_name ?? "Friend",
                amount: (donation.gross_source_cents / 100).toFixed(2),
                currency: donation.source_currency,
                donation_id: donation.public_id,
                date: donation.received_at.toISOString().slice(0, 10),
                project_name: project_id ? project_slug : null,
              },
            },
          },
          session
        );
      }
    });
  } finally {
    await session.endSession();
  }
}

async function handleRefund(
  ev: StripeEventPayload,
  orgId: mongoose.Types.ObjectId
): Promise<void> {
  const obj = ev.data.object as ChargeLike & { amount_refunded?: number };
  const charge_id = obj.id;
  if (!charge_id) return;
  const donation = await Donation.findOne({ stripe_charge_id: charge_id });
  if (!donation || !donation.transaction_id) return;
  if (donation.refund_transaction_id) return; // already handled

  const refunded = Number(obj.amount_refunded ?? 0);
  const partial = refunded > 0 && refunded < donation.gross_source_cents;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const orig = await FinancialTransaction.findById(donation.transaction_id).session(session);
      if (!orig) return;
      const pubId = await allocatePublic(orgId, "finance_txn", session);
      const [reversal] = await FinancialTransaction.create(
        [
          {
            organization_id: orgId,
            public_id: pubId,
            kind: "refund",
            state: "posted",
            source_currency: donation.source_currency,
            source_amount_cents: refunded > 0 ? refunded : donation.gross_source_cents,
            base_currency: donation.base_currency,
            base_amount_cents: refunded > 0 ? Math.round(refunded * (donation.fx_rate ?? 1)) : donation.gross_base_cents,
            fx_rate: donation.fx_rate,
            occurred_on: new Date(),
            memo: `Refund of ${donation.public_id}${partial ? " (partial)" : ""}`,
            created_by: donation._id,
            posted_by: donation._id,
            posted_at: new Date(),
            reversal_of: orig._id,
            donation_id: donation._id,
            lines: reversalLines(orig.lines),
          },
        ],
        { session }
      );
      if (!reversal) throw new AppError("internal_error", "refund creation failed");
      await postToLedger(reversal.toObject(), session);
      orig.state = "reversed";
      orig.reversed_at = new Date();
      await orig.save({ session });
      donation.refund_transaction_id = reversal._id;
      donation.status = partial ? "partially_refunded" : "refunded";
      donation.refunded_at = new Date();
      await donation.save({ session });
    });
  } finally {
    await session.endSession();
  }
}

async function handleDispute(
  ev: StripeEventPayload,
  _orgId: mongoose.Types.ObjectId
): Promise<void> {
  const obj = ev.data.object as { charge?: string };
  const charge_id = obj.charge;
  if (!charge_id) return;
  await Donation.updateOne({ stripe_charge_id: charge_id }, { $set: { status: "disputed" } });
}

async function allocatePublic(
  organization_id: mongoose.Types.ObjectId,
  kind: "donation" | "finance_txn",
  session: mongoose.ClientSession
): Promise<string> {
  const year = new Date().getUTCFullYear();
  const seq = await IdSequence.findOneAndUpdate(
    { organization_id, kind, year },
    { $inc: { next_value: 1 }, $setOnInsert: { organization_id, kind, year } },
    { upsert: true, new: true, session }
  );
  const n = (seq.next_value - 1).toString().padStart(5, "0");
  return kind === "donation" ? `DON-${year}-${n}` : `TXN-${year}-${n}`;
}
