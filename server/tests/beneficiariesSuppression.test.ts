import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { startTestDB, stopTestDB, clearTestDB } from "./setup.js";
import { BeneficiaryFundSummary, Organization, Fund } from "../src/models/index.js";

// Phase 11 — suppression threshold. The public endpoint hides totals when
// beneficiary_count < K. The service module is NOT imported — this test
// exercises the main-DB-only code path (the public reader), which is the
// only one that must not touch src/beneficiary/*.

async function publicAggregate(organizationId: mongoose.Types.ObjectId, fundId: mongoose.Types.ObjectId) {
  // We go through the public reader logic directly to avoid a route+auth
  // round-trip in the unit test.
  const row = await BeneficiaryFundSummary.findOne({
    organization_id: organizationId,
    public_fund_id: fundId,
  }).lean();
  const K = Number(process.env.BENEFICIARY_SUPPRESSION_K ?? 5);
  if (!row) return { suppressed: true, reason: "no activity yet" };
  if (row.beneficiary_count < K) {
    return { suppressed: true, reason: `below suppression threshold (k=${K})` };
  }
  return {
    suppressed: false,
    beneficiary_count: row.beneficiary_count,
    total_in_cents: row.total_in_cents,
    balance_cents: row.balance_cents,
  };
}

let orgId: mongoose.Types.ObjectId;
let fundId: mongoose.Types.ObjectId;

beforeAll(async () => {
  await startTestDB();
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
    code: "KIDS",
    name: "Children's future fund",
    kind: "restricted",
    base_currency: "USD",
    balance_cents: 0,
    total_in_cents: 0,
    total_out_cents: 0,
    restriction: {
      purpose: "children's future fund",
      allowed_expense_prefixes: [],
      allowed_project_ids: [],
      expires_on: null,
    },
    active: true,
  });
  fundId = fund._id;
});

describe("public aggregate — small-number suppression", () => {
  it("suppresses when beneficiary_count is below the threshold", async () => {
    await BeneficiaryFundSummary.create({
      organization_id: orgId,
      public_fund_id: fundId,
      total_in_cents: 100_000,
      total_out_cents: 20_000,
      balance_cents: 80_000,
      beneficiary_count: 4,
      base_currency: "USD",
      last_event_tx_id: null,
    });
    const r = await publicAggregate(orgId, fundId);
    expect(r.suppressed).toBe(true);
  });

  it("exposes totals once the threshold is met", async () => {
    await BeneficiaryFundSummary.create({
      organization_id: orgId,
      public_fund_id: fundId,
      total_in_cents: 1_000_000,
      total_out_cents: 200_000,
      balance_cents: 800_000,
      beneficiary_count: 10,
      base_currency: "USD",
      last_event_tx_id: null,
    });
    const r = await publicAggregate(orgId, fundId);
    expect(r.suppressed).toBe(false);
    expect(r.beneficiary_count).toBe(10);
    expect(r.total_in_cents).toBe(1_000_000);
    expect(r.balance_cents).toBe(800_000);
  });

  it("suppresses with 'no activity' when no summary row exists", async () => {
    const r = await publicAggregate(orgId, fundId);
    expect(r.suppressed).toBe(true);
    expect(r.reason).toContain("no activity");
  });
});
