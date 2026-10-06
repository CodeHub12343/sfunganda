import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { startTestDB, stopTestDB, clearTestDB } from "./setup.js";
import { Fund, InterOrgTransfer, LedgerEntry, Organization } from "../src/models/index.js";
import { initiateTransfer } from "../src/services/interOrgTransfers.js";
import type { Actor } from "../src/policy/index.js";

// Phase 13 — pay-it-forward end-to-end:
//   • both consent flags required
//   • restricted/endowed funds refused
//   • idempotency key collapses retries
//   • balances update on both sides atomically

let aOrg: mongoose.Types.ObjectId;
let bOrg: mongoose.Types.ObjectId;
let aFund: mongoose.Types.ObjectId;
let bFund: mongoose.Types.ObjectId;
let founderId: string;

function mk(user_id: string, organization_id: string, role = "founder"): Actor {
  return {
    user_id,
    organization_id,
    mfa_verified: true,
    assignments: [{ role: role as never, scope_type: "organization", scope_id: null }],
  };
}

beforeAll(async () => {
  await startTestDB();
});
afterAll(async () => {
  await stopTestDB();
});

beforeEach(async () => {
  await clearTestDB();
  founderId = new mongoose.Types.ObjectId().toString();
  const a = await Organization.create({
    slug: "aa",
    name: "A",
    public_id_prefix: "AA",
    base_currency: "USD",
    inter_org: { send_enabled: true, receive_enabled: false, allowed_recipient_slugs: [] },
  });
  const b = await Organization.create({
    slug: "bb",
    name: "B",
    public_id_prefix: "BB",
    base_currency: "USD",
    inter_org: { send_enabled: false, receive_enabled: true, allowed_recipient_slugs: [] },
  });
  aOrg = a._id;
  bOrg = b._id;
  const af = await Fund.create({
    organization_id: aOrg,
    code: "A-GEN",
    name: "general",
    kind: "general",
    base_currency: "USD",
    balance_cents: 100_000,
    total_in_cents: 100_000,
    total_out_cents: 0,
    restriction: null,
    active: true,
  });
  const bf = await Fund.create({
    organization_id: bOrg,
    code: "B-GEN",
    name: "general",
    kind: "general",
    base_currency: "USD",
    balance_cents: 0,
    total_in_cents: 0,
    total_out_cents: 0,
    restriction: null,
    active: true,
  });
  aFund = af._id;
  bFund = bf._id;
});

describe("inter-org transfer", () => {
  it("posts two ledger entries and moves denormalised balances", async () => {
    const r = await initiateTransfer(mk(founderId, aOrg.toString()), {
      to_organization_slug: "bb",
      from_fund_id: aFund.toString(),
      to_fund_id: bFund.toString(),
      amount_cents: 50_000,
      currency: "USD",
      idempotency_key: "k1",
    });
    expect(r.state).toBe("posted");
    const row = await InterOrgTransfer.findById(r.id).lean();
    expect(row!.state).toBe("posted");
    expect(row!.from_ledger_entry_id).not.toBeNull();
    expect(row!.to_ledger_entry_id).not.toBeNull();

    const aLedger = await LedgerEntry.find({ organization_id: aOrg }).lean();
    const bLedger = await LedgerEntry.find({ organization_id: bOrg }).lean();
    expect(aLedger.length).toBe(1);
    expect(bLedger.length).toBe(1);
    expect(aLedger[0]!.side).toBe("debit");
    expect(bLedger[0]!.side).toBe("credit");

    const aAfter = await Fund.findById(aFund).lean();
    const bAfter = await Fund.findById(bFund).lean();
    expect(aAfter!.balance_cents).toBe(50_000);
    expect(bAfter!.balance_cents).toBe(50_000);
  });

  it("refuses when the SENDER has not enabled sending", async () => {
    await Organization.updateOne({ _id: aOrg }, { $set: { "inter_org.send_enabled": false } });
    await expect(
      initiateTransfer(mk(founderId, aOrg.toString()), {
        to_organization_slug: "bb",
        from_fund_id: aFund.toString(),
        to_fund_id: bFund.toString(),
        amount_cents: 1_000,
        currency: "USD",
        idempotency_key: "k2",
      })
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("refuses when the RECIPIENT has not enabled receiving", async () => {
    await Organization.updateOne({ _id: bOrg }, { $set: { "inter_org.receive_enabled": false } });
    await expect(
      initiateTransfer(mk(founderId, aOrg.toString()), {
        to_organization_slug: "bb",
        from_fund_id: aFund.toString(),
        to_fund_id: bFund.toString(),
        amount_cents: 1_000,
        currency: "USD",
        idempotency_key: "k3",
      })
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("refuses when the recipient has an allow-list that excludes the sender", async () => {
    await Organization.updateOne(
      { _id: bOrg },
      { $set: { "inter_org.allowed_recipient_slugs": ["zz"] } }
    );
    await expect(
      initiateTransfer(mk(founderId, aOrg.toString()), {
        to_organization_slug: "bb",
        from_fund_id: aFund.toString(),
        to_fund_id: bFund.toString(),
        amount_cents: 1_000,
        currency: "USD",
        idempotency_key: "k4",
      })
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("refuses to move money out of a restricted fund", async () => {
    const r = await Fund.create({
      organization_id: aOrg,
      code: "A-REST",
      name: "restricted",
      kind: "restricted",
      base_currency: "USD",
      balance_cents: 100_000,
      total_in_cents: 100_000,
      total_out_cents: 0,
      restriction: {
        purpose: "x",
        allowed_expense_prefixes: [],
        allowed_project_ids: [],
        expires_on: null,
      },
      active: true,
    });
    await expect(
      initiateTransfer(mk(founderId, aOrg.toString()), {
        to_organization_slug: "bb",
        from_fund_id: r._id.toString(),
        to_fund_id: bFund.toString(),
        amount_cents: 1_000,
        currency: "USD",
        idempotency_key: "k5",
      })
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("returns the same row on a replay with the same idempotency key", async () => {
    const r1 = await initiateTransfer(mk(founderId, aOrg.toString()), {
      to_organization_slug: "bb",
      from_fund_id: aFund.toString(),
      to_fund_id: bFund.toString(),
      amount_cents: 20_000,
      currency: "USD",
      idempotency_key: "same",
    });
    const r2 = await initiateTransfer(mk(founderId, aOrg.toString()), {
      to_organization_slug: "bb",
      from_fund_id: aFund.toString(),
      to_fund_id: bFund.toString(),
      amount_cents: 20_000,
      currency: "USD",
      idempotency_key: "same",
    });
    expect(r2.id).toBe(r1.id);
    const bAfter = await Fund.findById(bFund).lean();
    expect(bAfter!.balance_cents).toBe(20_000); // posted exactly once
  });

  it("refuses non-founder actors (policy enforced)", async () => {
    await expect(
      initiateTransfer(mk(founderId, aOrg.toString(), "finance_manager"), {
        to_organization_slug: "bb",
        from_fund_id: aFund.toString(),
        to_fund_id: bFund.toString(),
        amount_cents: 1_000,
        currency: "USD",
        idempotency_key: "k6",
      })
    ).rejects.toMatchObject({ code: "forbidden" });
  });
});
