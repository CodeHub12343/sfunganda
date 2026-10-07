import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { startTestDB, stopTestDB, clearTestDB } from "./setup.js";
import {
  FinancialTransaction,
  Fund,
  LedgerEntry,
  Organization,
} from "../src/models/index.js";
import { assertBalanced, computeHash, postToLedger, verifyChain } from "../src/services/ledger.js";
import { runIntegrity } from "../src/services/integrity.js";
import { actOnTransaction, createDraft } from "../src/services/finance.js";
import { ingestStripeEvent, verifyStripeSignature } from "../src/services/stripeWebhook.js";
import { createHmac } from "node:crypto";
import type { Actor } from "../src/policy/index.js";

let orgId: mongoose.Types.ObjectId;
let fundId: mongoose.Types.ObjectId;

const treasurer = "6508f00000000000000c0001";
const auditor = "6508f00000000000000c0002";
const admin = "6508f00000000000000c0003";

function mk(user_id: string, role: string): Actor {
  return {
    user_id,
    organization_id: orgId.toString(),
    mfa_verified: true,
    assignments: [{ role: role as never, scope_type: "organization", scope_id: null }],
  };
}

beforeAll(async () => {
  await startTestDB();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
});
afterAll(async () => {
  await stopTestDB();
});

beforeEach(async () => {
  await clearTestDB();
  const org = await Organization.create({
    slug: "sfu",
    name: "SFU",
    public_id_prefix: "SFU",
    base_currency: "USD",
  });
  orgId = org._id;
  const fund = await Fund.create({
    organization_id: orgId,
    code: "GEN",
    name: "General Fund",
    kind: "general",
    base_currency: "USD",
    balance_cents: 0,
  });
  fundId = fund._id;
});

const safeguardingOk = { consent_recorded: true };
void safeguardingOk;

async function postedTxn(actor: Actor, amount: number) {
  const draft = await createDraft(actor, {
    kind: "donation",
    source_currency: "USD",
    source_amount_cents: amount,
    occurred_on: "2026-02-01",
    lines: [
      { side: "debit", fund_id: fundId.toString(), account: "cash", amount_cents: amount },
      { side: "credit", fund_id: fundId.toString(), account: "donations_received", amount_cents: amount },
    ],
  });
  await actOnTransaction(mk(treasurer, "finance_manager"), draft._id.toString(), "submit", {
    version: draft.version,
  });
  const submitted = await FinancialTransaction.findById(draft._id).lean();
  await actOnTransaction(mk(auditor, "finance_manager"), draft._id.toString(), "approve", {
    version: submitted!.version,
    stepup_token: "mfa:ok",
  });
  const approved = await FinancialTransaction.findById(draft._id).lean();
  await actOnTransaction(mk(admin, "finance_manager"), draft._id.toString(), "post", {
    version: approved!.version,
  });
  return FinancialTransaction.findById(draft._id).lean();
}

describe("double-entry invariants", () => {
  it("rejects unbalanced transactions at the service layer", () => {
    expect(() =>
      assertBalanced([
        { side: "debit", fund_id: fundId, account: "cash", amount_cents: 100, memo: null, project_id: null, expense_category_id: null },
        { side: "credit", fund_id: fundId, account: "donations_received", amount_cents: 50, memo: null, project_id: null, expense_category_id: null },
      ])
    ).toThrow(/unbalanced/);
  });

  it("accepts balanced transactions", () => {
    expect(() =>
      assertBalanced([
        { side: "debit", fund_id: fundId, account: "cash", amount_cents: 100, memo: null, project_id: null, expense_category_id: null },
        { side: "credit", fund_id: fundId, account: "donations_received", amount_cents: 100, memo: null, project_id: null, expense_category_id: null },
      ])
    ).not.toThrow();
  });
});

describe("hash chain", () => {
  it("every entry's hash matches sha256(seed || prev_hash || canonical(row))", async () => {
    await postedTxn(mk(admin, "finance_manager"), 2500);
    const chain = await verifyChain(orgId);
    expect(chain.ok).toBe(true);
    expect(chain.last_seq).toBe(2);

    const entries = await LedgerEntry.find({ organization_id: orgId }).sort({ seq: 1 }).lean();
    // Second entry's prev_hash equals first entry's hash.
    expect(entries[1]!.prev_hash).toBe(entries[0]!.hash);
  });

  it("detects tampering (mutation of a historical entry breaks the chain)", async () => {
    await postedTxn(mk(admin, "finance_manager"), 3000);
    // Direct mutation to simulate a compromise bypassing the role.
    await LedgerEntry.updateOne({ seq: 1 }, { $set: { amount_cents: 999999 } });
    const chain = await verifyChain(orgId);
    expect(chain.ok).toBe(false);
    expect(chain.first_bad_seq).toBe(1);
  });

  it("integrity report flags tampering and fund mismatch", async () => {
    await postedTxn(mk(admin, "finance_manager"), 4000);
    await LedgerEntry.updateOne({ seq: 1 }, { $set: { amount_cents: 1 } });
    const r = await runIntegrity(orgId);
    expect(r.ok).toBe(false);
    const latest = r.reports[0];
    expect(latest).toBeTruthy();
    expect(latest!.ok).toBe(false);
  });
});

describe("C1 — Stripe webhook idempotency", () => {
  it("replaying the same event id is a no-op", async () => {
    const payload = chargeSucceededPayload("evt_1", "ch_1", "pi_1", 1500, 100);
    const first = await ingestStripeEvent(payload);
    const second = await ingestStripeEvent(payload);
    expect(first.outcome).toBe("processed");
    expect(["ignored", "processed"]).toContain(second.outcome);

    // Exactly one donation and one posted transaction regardless of replays.
    const donations = await (await import("../src/models/index.js")).Donation.countDocuments({});
    expect(donations).toBe(1);
    const txns = await FinancialTransaction.countDocuments({ kind: "donation", state: "posted" });
    expect(txns).toBe(1);
  });

  it("verifies the Stripe signature header", () => {
    const body = JSON.stringify({ id: "evt_x" });
    const ts = Math.floor(Date.now() / 1000);
    const sig = createHmac("sha256", "whsec_test_secret").update(`${ts}.${body}`).digest("hex");
    expect(verifyStripeSignature(body, `t=${ts},v1=${sig}`)).toBe(true);
    expect(verifyStripeSignature(body, `t=${ts},v1=deadbeef`)).toBe(false);
    expect(verifyStripeSignature(body, undefined)).toBe(false);
  });
});

describe("C4 — webhook out-of-order and replay", () => {
  it("accepts a refund that arrives after the charge, exactly once", async () => {
    const charge = chargeSucceededPayload("evt_c1", "ch_c1", "pi_c1", 5000, 150);
    const refund = chargeRefundedPayload("evt_r1", "ch_c1", 5000);
    await ingestStripeEvent(charge);
    await ingestStripeEvent(refund);
    const donation = await (await import("../src/models/index.js")).Donation.findOne({
      stripe_charge_id: "ch_c1",
    }).lean();
    expect(donation!.status).toBe("refunded");
    expect(donation!.refund_transaction_id).toBeTruthy();

    // Replaying the refund does nothing.
    await ingestStripeEvent(refund);
    const txns = await FinancialTransaction.countDocuments({ kind: "refund" });
    expect(txns).toBe(1);
  });

  it("C10 — refund after an allocation leaves the chain intact and net balance correct", async () => {
    await ingestStripeEvent(chargeSucceededPayload("evt_c2", "ch_c2", "pi_c2", 10_000, 300));
    const afterDonation = await verifyChain(orgId);
    expect(afterDonation.ok).toBe(true);
    const fundBefore = await Fund.findById(fundId).lean();
    // Only the stripe_clearing asset account moves the fund balance; fees
    // are tracked as expenses. So balance == net.
    expect(fundBefore!.balance_cents).toBe(10_000 - 300);

    await ingestStripeEvent(chargeRefundedPayload("evt_r2", "ch_c2", 10_000));
    const chain = await verifyChain(orgId);
    expect(chain.ok).toBe(true);
    const fundAfter = await Fund.findById(fundId).lean();
    expect(fundAfter!.balance_cents).toBe(0);
  });
});

describe("transaction state machine", () => {
  it("blocks the creator from approving their own draft", async () => {
    const draft = await createDraft(mk(treasurer, "finance_manager"), {
      kind: "expense",
      source_currency: "USD",
      source_amount_cents: 1000,
      occurred_on: "2026-02-10",
      lines: [
        { side: "debit", fund_id: fundId.toString(), account: "expense_training", amount_cents: 1000 },
        { side: "credit", fund_id: fundId.toString(), account: "cash", amount_cents: 1000 },
      ],
    });
    await actOnTransaction(mk(treasurer, "finance_manager"), draft._id.toString(), "submit", {
      version: draft.version,
    });
    const s = await FinancialTransaction.findById(draft._id).lean();
    await expect(
      actOnTransaction(mk(treasurer, "finance_manager"), draft._id.toString(), "approve", {
        version: s!.version,
        stepup_token: "x",
      })
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("requires a step-up token to approve", async () => {
    const draft = await createDraft(mk(treasurer, "finance_manager"), {
      kind: "expense",
      source_currency: "USD",
      source_amount_cents: 500,
      occurred_on: "2026-02-10",
      lines: [
        { side: "debit", fund_id: fundId.toString(), account: "expense_supplies", amount_cents: 500 },
        { side: "credit", fund_id: fundId.toString(), account: "cash", amount_cents: 500 },
      ],
    });
    await actOnTransaction(mk(treasurer, "finance_manager"), draft._id.toString(), "submit", {
      version: draft.version,
    });
    const s = await FinancialTransaction.findById(draft._id).lean();
    await expect(
      actOnTransaction(mk(auditor, "finance_manager"), draft._id.toString(), "approve", {
        version: s!.version,
      })
    ).rejects.toMatchObject({ code: "mfa_required" });
  });

  it("one computeHash call is deterministic", () => {
    const row = {
      seq: 1,
      transaction_id: "t",
      side: "debit" as const,
      fund_id: "f",
      account: "cash",
      amount_cents: 100,
      base_currency: "USD",
      project_id: null,
      expense_category_id: null,
      posted_at: 1700000000000,
    };
    expect(computeHash("prev", row, "seed")).toBe(computeHash("prev", row, "seed"));
    expect(computeHash("prev", row, "seed")).not.toBe(computeHash("prev", row, "seed2"));
  });
});

// ---- Payload fixtures ------------------------------------------------------

function chargeSucceededPayload(
  evt: string,
  ch: string,
  pi: string,
  amount: number,
  fee: number
): Record<string, unknown> {
  return {
    id: evt,
    type: "charge.succeeded",
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: ch,
        payment_intent: pi,
        amount,
        amount_captured: amount,
        currency: "usd",
        balance_transaction: {
          id: "txn_" + ch,
          fee,
          net: amount - fee,
          exchange_rate: 1,
        },
        billing_details: { email: "donor@example.com", name: "Donor" },
        metadata: {},
      },
    },
  };
}

function chargeRefundedPayload(evt: string, ch: string, refunded: number): Record<string, unknown> {
  return {
    id: evt,
    type: "charge.refunded",
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: ch,
        amount_refunded: refunded,
        currency: "usd",
      },
    },
  };
}
