import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { startTestDB, stopTestDB, clearTestDB } from "./setup.js";
import {
  AccountingPeriod,
  Fund,
  FinancialTransaction,
  Organization,
  Project,
} from "../src/models/index.js";
import { actOnTransaction, createDraft, requiresDualApproval } from "../src/services/finance.js";
import { createAllocationDraft } from "../src/services/allocations.js";
import { recordRate } from "../src/services/fx.js";
import { convertToBase } from "../src/services/fx.js";
import { ensurePeriod, setPeriodStatus } from "../src/services/periods.js";
import { verifyChain } from "../src/services/ledger.js";
import type { Actor } from "../src/policy/index.js";

let orgId: mongoose.Types.ObjectId;
let generalFund: mongoose.Types.ObjectId;
let restrictedFund: mongoose.Types.ObjectId;
let secondFund: mongoose.Types.ObjectId;
let project: mongoose.Types.ObjectId;
let otherProject: mongoose.Types.ObjectId;

const alice = "6508f00000000000000d0001";
const bob = "6508f00000000000000d0002";
const carol = "6508f00000000000000d0003";
const dave = "6508f00000000000000d0004";

function mk(user_id: string, role: string = "finance_manager"): Actor {
  return {
    user_id,
    organization_id: orgId.toString(),
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
  const org = await Organization.create({
    slug: "sfu",
    name: "SFU",
    public_id_prefix: "SFU",
    base_currency: "USD",
  });
  orgId = org._id;

  const p1 = await Project.create({
    organization_id: orgId,
    community_id: new mongoose.Types.ObjectId(),
    name: "Clean Water",
    slug: "clean-water",
    summary: "Boreholes",
  });
  project = p1._id;
  const p2 = await Project.create({
    organization_id: orgId,
    community_id: new mongoose.Types.ObjectId(),
    name: "Education",
    slug: "education",
    summary: "Schools",
  });
  otherProject = p2._id;

  const gen = await Fund.create({
    organization_id: orgId,
    code: "GEN",
    name: "General",
    kind: "general",
    base_currency: "USD",
    balance_cents: 100_000_00,
    total_in_cents: 100_000_00,
  });
  generalFund = gen._id;

  const rest = await Fund.create({
    organization_id: orgId,
    code: "WATER",
    name: "Water Fund",
    kind: "restricted",
    base_currency: "USD",
    balance_cents: 50_000_00,
    total_in_cents: 50_000_00,
    restriction: {
      purpose: "Water & sanitation only",
      allowed_expense_prefixes: ["expense_materials", "expense_transport"],
      allowed_project_ids: [project],
      expires_on: null,
    },
  });
  restrictedFund = rest._id;

  const sec = await Fund.create({
    organization_id: orgId,
    code: "SCHOOL",
    name: "School Fund",
    kind: "project",
    base_currency: "USD",
    project_id: otherProject,
    balance_cents: 0,
  });
  secondFund = sec._id;
});

async function doPostWithOverrides(opts: {
  actor: Actor;
  amount: number;
  fund_id: string;
  account?: string;
  project_id?: string | null;
  occurred_on?: string;
  approver?: Actor;
  secondApprover?: Actor | null;
  poster?: Actor;
}) {
  const occurred = opts.occurred_on ?? "2026-03-15";
  const draft = await createDraft(opts.actor, {
    kind: "expense",
    source_currency: "USD",
    source_amount_cents: opts.amount,
    occurred_on: occurred,
    lines: [
      {
        side: "debit",
        fund_id: opts.fund_id,
        account: opts.account ?? "expense_materials",
        amount_cents: opts.amount,
        project_id: opts.project_id ?? null,
      },
      {
        side: "credit",
        fund_id: opts.fund_id,
        account: "cash",
        amount_cents: opts.amount,
        project_id: opts.project_id ?? null,
      },
    ],
  });
  const after1 = await actOnTransaction(opts.actor, draft._id.toString(), "submit", {
    version: draft.version,
  });
  const approver = opts.approver ?? mk(bob);
  const after2 = await actOnTransaction(approver, draft._id.toString(), "approve", {
    version: after1.version,
    stepup_token: "mfa:ok",
  });
  if (requiresDualApproval(after2.base_amount_cents)) {
    if (opts.secondApprover === null) return after2;
    const second = opts.secondApprover ?? mk(carol);
    const after3 = await actOnTransaction(second, draft._id.toString(), "approve", {
      version: after2.version,
      stepup_token: "mfa:ok",
    });
    const poster = opts.poster ?? mk(dave);
    return actOnTransaction(poster, draft._id.toString(), "post", { version: after3.version });
  }
  const poster = opts.poster ?? mk(carol);
  return actOnTransaction(poster, draft._id.toString(), "post", { version: after2.version });
}

describe("restricted-fund enforcement", () => {
  it("rejects an expense account not in the fund's allow-list", async () => {
    await expect(
      createDraft(mk(alice), {
        kind: "expense",
        source_currency: "USD",
        source_amount_cents: 1000,
        occurred_on: "2026-03-15",
        lines: [
          {
            side: "debit",
            fund_id: restrictedFund.toString(),
            account: "expense_training",
            amount_cents: 1000,
          },
          {
            side: "credit",
            fund_id: restrictedFund.toString(),
            account: "cash",
            amount_cents: 1000,
          },
        ],
      })
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("rejects an expense tied to a project outside the fund's project allow-list", async () => {
    await expect(
      createDraft(mk(alice), {
        kind: "expense",
        source_currency: "USD",
        source_amount_cents: 1000,
        occurred_on: "2026-03-15",
        lines: [
          {
            side: "debit",
            fund_id: restrictedFund.toString(),
            account: "expense_materials",
            amount_cents: 1000,
            project_id: otherProject.toString(),
          },
          {
            side: "credit",
            fund_id: restrictedFund.toString(),
            account: "cash",
            amount_cents: 1000,
            project_id: otherProject.toString(),
          },
        ],
      })
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("accepts an expense that satisfies the restriction", async () => {
    const posted = await doPostWithOverrides({
      actor: mk(alice),
      amount: 1000,
      fund_id: restrictedFund.toString(),
      account: "expense_materials",
      project_id: project.toString(),
    });
    expect(posted.state).toBe("posted");
  });
});

describe("period lock", () => {
  it("refuses to post into a closed period", async () => {
    // Pre-create and close the period for the expense date.
    const p = await ensurePeriod(orgId, "2026-03");
    await setPeriodStatus(mk(alice, "founder"), "2026-03", "pending_close", p.version);
    const p2 = await AccountingPeriod.findOne({ organization_id: orgId, code: "2026-03" }).lean();
    await setPeriodStatus(mk(alice, "founder"), "2026-03", "closed", p2!.version);

    const draft = await createDraft(mk(alice), {
      kind: "expense",
      source_currency: "USD",
      source_amount_cents: 500,
      occurred_on: "2026-03-15",
      lines: [
        { side: "debit", fund_id: generalFund.toString(), account: "expense_training", amount_cents: 500 },
        { side: "credit", fund_id: generalFund.toString(), account: "cash", amount_cents: 500 },
      ],
    });
    await actOnTransaction(mk(alice), draft._id.toString(), "submit", { version: draft.version });
    const s = await FinancialTransaction.findById(draft._id).lean();
    await actOnTransaction(mk(bob), draft._id.toString(), "approve", {
      version: s!.version,
      stepup_token: "x",
    });
    const a = await FinancialTransaction.findById(draft._id).lean();
    await expect(
      actOnTransaction(mk(carol), draft._id.toString(), "post", { version: a!.version })
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("accepts the post once the period is reopened", async () => {
    const p = await ensurePeriod(orgId, "2026-03");
    await setPeriodStatus(mk(alice, "founder"), "2026-03", "pending_close", p.version);
    const p2 = await AccountingPeriod.findOne({ organization_id: orgId, code: "2026-03" }).lean();
    await setPeriodStatus(mk(alice, "founder"), "2026-03", "closed", p2!.version);

    // Reopen.
    const p3 = await AccountingPeriod.findOne({ organization_id: orgId, code: "2026-03" }).lean();
    const reopened = await setPeriodStatus(mk(alice, "founder"), "2026-03", "open", p3!.version);
    expect(reopened.reopened_count).toBeGreaterThanOrEqual(1);

    const posted = await doPostWithOverrides({
      actor: mk(alice),
      amount: 500,
      fund_id: generalFund.toString(),
      account: "expense_training",
      occurred_on: "2026-03-15",
    });
    expect(posted.state).toBe("posted");
    expect(posted.period_code).toBe("2026-03");
  });
});

describe("dual approval", () => {
  it("requires a second, distinct approver above the threshold", async () => {
    const amount = 1_000_000_00; // 1,000,000 USD cents (well above default 500,000)
    const draft = await createDraft(mk(alice), {
      kind: "expense",
      source_currency: "USD",
      source_amount_cents: amount,
      occurred_on: "2026-03-15",
      lines: [
        { side: "debit", fund_id: generalFund.toString(), account: "expense_training", amount_cents: amount },
        { side: "credit", fund_id: generalFund.toString(), account: "cash", amount_cents: amount },
      ],
    });
    await actOnTransaction(mk(alice), draft._id.toString(), "submit", { version: draft.version });
    const s = await FinancialTransaction.findById(draft._id).lean();
    const first = await actOnTransaction(mk(bob), draft._id.toString(), "approve", {
      version: s!.version,
      stepup_token: "x",
    });
    // Still in submitted — second approver needed.
    expect(first.state).toBe("submitted");
    expect(first.approved_by!.toString()).toBe(bob);

    // Posting now must be refused.
    await expect(
      actOnTransaction(mk(dave), draft._id.toString(), "post", { version: first.version })
    ).rejects.toMatchObject({ code: "conflict" });

    // Second approver cannot be the same person.
    await expect(
      actOnTransaction(mk(bob), draft._id.toString(), "approve", {
        version: first.version,
        stepup_token: "x",
      })
    ).rejects.toMatchObject({ code: "forbidden" });

    // Second approver cannot be the creator.
    await expect(
      actOnTransaction(mk(alice), draft._id.toString(), "approve", {
        version: first.version,
        stepup_token: "x",
      })
    ).rejects.toMatchObject({ code: "forbidden" });

    // A distinct second approver completes the flow.
    const second = await actOnTransaction(mk(carol), draft._id.toString(), "approve", {
      version: first.version,
      stepup_token: "x",
    });
    expect(second.state).toBe("approved");
    expect(second.secondary_approved_by!.toString()).toBe(carol);

    const posted = await actOnTransaction(mk(dave), draft._id.toString(), "post", {
      version: second.version,
    });
    expect(posted.state).toBe("posted");
  });

  it("does not require a second approver below the threshold", async () => {
    const posted = await doPostWithOverrides({
      actor: mk(alice),
      amount: 10_000, // 100.00 USD
      fund_id: generalFund.toString(),
      account: "expense_training",
    });
    expect(posted.state).toBe("posted");
    expect(posted.secondary_approved_by).toBeNull();
  });
});

describe("allocations (fund transfer)", () => {
  it("moves balance between funds and keeps the chain intact", async () => {
    const draft = await createAllocationDraft(mk(alice), {
      source_fund_id: generalFund.toString(),
      destination_fund_id: secondFund.toString(),
      amount_cents: 1_000_00,
      occurred_on: "2026-03-20",
    });
    await actOnTransaction(mk(alice), draft._id.toString(), "submit", { version: draft.version });
    const s = await FinancialTransaction.findById(draft._id).lean();
    await actOnTransaction(mk(bob), draft._id.toString(), "approve", {
      version: s!.version,
      stepup_token: "x",
    });
    const a = await FinancialTransaction.findById(draft._id).lean();
    await actOnTransaction(mk(carol), draft._id.toString(), "post", { version: a!.version });

    const [src, dst] = await Promise.all([
      Fund.findById(generalFund).lean(),
      Fund.findById(secondFund).lean(),
    ]);
    expect(src!.balance_cents).toBe(100_000_00 - 1_000_00);
    expect(dst!.balance_cents).toBe(1_000_00);
    const chain = await verifyChain(orgId);
    expect(chain.ok).toBe(true);
  });

  it("rejects an allocation exceeding the source fund balance", async () => {
    await expect(
      createAllocationDraft(mk(alice), {
        source_fund_id: generalFund.toString(),
        destination_fund_id: secondFund.toString(),
        amount_cents: 1_000_000_00,
        occurred_on: "2026-03-20",
      })
    ).rejects.toMatchObject({ code: "unprocessable" });
  });
});

describe("fx service", () => {
  it("round-trips a recorded rate", async () => {
    await recordRate(orgId, { from: "UGX", to: "USD", rate: 0.00027, on_date: new Date("2026-03-01") });
    const { base_cents, rate } = await convertToBase(orgId, 1_000_000_00, "UGX", new Date("2026-03-15"));
    expect(rate).toBeCloseTo(0.00027, 8);
    // 1,000,000 UGX cents * 0.00027 = 270 USD cents (rounded)
    expect(base_cents).toBe(Math.round(1_000_000_00 * 0.00027));
  });

  it("1:1 for same-currency conversions", async () => {
    const r = await convertToBase(orgId, 500, "USD", new Date());
    expect(r.base_cents).toBe(500);
    expect(r.rate).toBe(1);
  });

  it("rejects conversion when no rate is on file", async () => {
    await expect(convertToBase(orgId, 100, "EUR", new Date())).rejects.toMatchObject({
      code: "unavailable",
    });
  });
});
