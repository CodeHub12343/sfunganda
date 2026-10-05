import mongoose from "mongoose";
import { Donation, Fund, IdSequence, Project } from "@/models/index.js";
import type { DonationDoc } from "@/models/Donation.js";
import { AppError } from "@/util/errors.js";
import { can, type Actor } from "@/policy/index.js";
import { createDraft } from "./finance.js";
import { convertToBase } from "./fx.js";

// Operator-captured donation (cash in hand, bank transfer, mobile money).
// Creates both the Donation row and a DRAFT transaction. The transaction
// goes through the usual approve+post flow — the Stripe webhook path is
// not used.
export async function recordOfflineDonation(
  actor: Actor,
  input: {
    donor_name?: string;
    donor_email?: string;
    anonymous?: boolean;
    project_slug?: string;
    source_currency: string;
    gross_source_cents: number;
    fee_source_cents?: number;
    received_on: string;
    channel: "cash" | "bank" | "mobile_money" | "cheque" | "other";
    reference?: string;
    memo?: string;
  }
): Promise<DonationDoc> {
  if (!can(actor, "finance.write", { kind: "finance", organization_id: actor.organization_id }))
    throw new AppError("forbidden", "cannot record donations");

  const orgId = new mongoose.Types.ObjectId(actor.organization_id);
  const gross = input.gross_source_cents;
  const fee = input.fee_source_cents ?? 0;
  const net = gross - fee;
  if (net < 0) throw new AppError("unprocessable", "fee exceeds gross");

  // Project designation + target fund.
  let project_id: mongoose.Types.ObjectId | null = null;
  let fund = await Fund.findOne({ organization_id: orgId, kind: "general", active: true });
  if (input.project_slug) {
    const p = await Project.findOne({ organization_id: orgId, slug: input.project_slug }).lean();
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
  if (!fund) throw new AppError("not_found", "no fund configured");

  const occurred = new Date(input.received_on);
  const grossBase = await convertToBase(orgId, gross, input.source_currency, occurred);
  const feeBase = await convertToBase(orgId, fee, input.source_currency, occurred);
  const netBase = { base_cents: grossBase.base_cents - feeBase.base_cents, rate: grossBase.rate };

  const year = new Date().getUTCFullYear();
  const seq = await IdSequence.findOneAndUpdate(
    { organization_id: orgId, kind: "donation", year },
    { $inc: { next_value: 1 }, $setOnInsert: { organization_id: orgId, kind: "donation", year } },
    { upsert: true, new: true }
  );
  const public_id = `DON-${year}-${(seq.next_value - 1).toString().padStart(5, "0")}`;

  const donation = await Donation.create({
    organization_id: orgId,
    public_id,
    donor_name: input.anonymous ? null : input.donor_name ?? null,
    donor_email: input.anonymous ? null : input.donor_email ?? null,
    anonymous: !!input.anonymous,
    project_id,
    fund_id: fund._id,
    source_currency: input.source_currency.toUpperCase(),
    gross_source_cents: gross,
    fee_source_cents: fee,
    net_source_cents: net,
    base_currency: fund.base_currency,
    gross_base_cents: grossBase.base_cents,
    fee_base_cents: feeBase.base_cents,
    net_base_cents: netBase.base_cents,
    fx_rate: grossBase.rate === 1 ? null : grossBase.rate,
    processor: "manual",
    stripe_charge_id: null,
    stripe_payment_intent_id: null,
    stripe_customer_id: null,
    recurring: false,
    status: "succeeded",
    received_at: occurred,
  });

  // Draft a matching transaction (cash in).
  const draft = await createDraft(actor, {
    kind: "donation",
    source_currency: input.source_currency,
    source_amount_cents: gross,
    base_currency: fund.base_currency,
    base_amount_cents: grossBase.base_cents,
    fx_rate: grossBase.rate === 1 ? undefined : grossBase.rate,
    occurred_on: input.received_on,
    memo: `${input.channel} donation ${public_id}${input.reference ? " · " + input.reference : ""}${input.memo ? " · " + input.memo : ""}`,
    donation_id: donation._id.toString(),
    lines:
      fee > 0
        ? [
            { side: "debit", fund_id: fund._id.toString(), account: "cash", amount_cents: netBase.base_cents, project_id: project_id?.toString() ?? null },
            { side: "debit", fund_id: fund._id.toString(), account: "payment_fees", amount_cents: feeBase.base_cents, project_id: project_id?.toString() ?? null },
            { side: "credit", fund_id: fund._id.toString(), account: "donations_received", amount_cents: grossBase.base_cents, project_id: project_id?.toString() ?? null },
          ]
        : [
            { side: "debit", fund_id: fund._id.toString(), account: "cash", amount_cents: grossBase.base_cents, project_id: project_id?.toString() ?? null },
            { side: "credit", fund_id: fund._id.toString(), account: "donations_received", amount_cents: grossBase.base_cents, project_id: project_id?.toString() ?? null },
          ],
  });
  donation.transaction_id = draft._id;
  await donation.save();
  return donation.toObject();
}
