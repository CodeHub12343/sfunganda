import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { startTestDB, stopTestDB, clearTestDB } from "./setup.js";
import { ExpenseCategory, LedgerEntry, Fund } from "../src/models/index.js";
import { compileSnapshot } from "../src/services/reportCompiler.js";

// =============================================================================
// Phase 9 testing: "figures in the PDF equal the snapshot equal the ledger at
// period end".
//
// We seed ledger_entries directly for the period under test and for the
// period AFTER it, then confirm the compiler reports ONLY the first period's
// numbers — the hand-recomputable rows match the ledger-aggregate figure the
// snapshot carries.
// =============================================================================

async function seed(orgId: mongoose.Types.ObjectId): Promise<void> {
  const op = await ExpenseCategory.create({
    organization_id: orgId,
    slug: "op-food",
    name: "Op · Food",
    is_operating: true,
  });
  const prog = await ExpenseCategory.create({
    organization_id: orgId,
    slug: "prog-care",
    name: "Prog · Care",
    is_programme: true,
  });
  // No funds balance test here — focus on in-period aggregates.
  void Fund;

  const inPeriod = new Date(Date.UTC(2026, 2, 15));
  const afterPeriod = new Date(Date.UTC(2026, 3, 2));

  const common = {
    organization_id: orgId,
    base_currency: "USD",
    transaction_id: new mongoose.Types.ObjectId(),
    prev_hash: "0".repeat(64),
    fund_id: new mongoose.Types.ObjectId(),
  };

  const rows = [
    { seq: 1, side: "credit", account: "revenue_business", amount_cents: 50_000, posted_at: inPeriod, hash: "a".padStart(64, "0") },
    { seq: 2, side: "credit", account: "donations_received", amount_cents: 100_000, posted_at: inPeriod, hash: "b".padStart(64, "0") },
    { seq: 3, side: "debit", account: "expense_food", amount_cents: 20_000, posted_at: inPeriod, expense_category_id: op._id, hash: "c".padStart(64, "0") },
    { seq: 4, side: "debit", account: "expense_care", amount_cents: 15_000, posted_at: inPeriod, expense_category_id: prog._id, hash: "d".padStart(64, "0") },
    // Rows OUTSIDE the period — the compiler must ignore these.
    { seq: 5, side: "credit", account: "revenue_business", amount_cents: 999_999, posted_at: afterPeriod, hash: "e".padStart(64, "0") },
    { seq: 6, side: "debit", account: "expense_food", amount_cents: 888_888, posted_at: afterPeriod, expense_category_id: op._id, hash: "f".padStart(64, "0") },
  ];
  for (const r of rows) {
    await LedgerEntry.create({ ...common, ...r } as unknown as Record<string, unknown>);
  }
}

describe("report snapshot ≡ ledger (period end)", () => {
  beforeAll(async () => {
    await startTestDB();
  });
  afterAll(async () => {
    await stopTestDB();
  });
  beforeEach(async () => {
    await clearTestDB();
  });

  it("snapshot numbers equal the in-period ledger aggregates", async () => {
    const orgId = new mongoose.Types.ObjectId();
    await seed(orgId);
    const snap = await compileSnapshot({
      organization_id: orgId,
      period_code: "2026-03",
      compiled_by: "test",
    });

    expect(snap.period_code).toBe("2026-03");
    expect(snap.finance.donations_received_base_cents).toBe(100_000);
    expect(snap.finance.business_revenue_base_cents).toBe(50_000);
    expect(snap.finance.operating_expenses_base_cents).toBe(20_000);
    expect(snap.finance.programme_expenses_base_cents).toBe(15_000);
    expect(snap.finance.sustainability_ratio).toBeCloseTo(50_000 / 20_000, 10);

    // Independently recompute from the ledger — this is what a visitor
    // could do with the public endpoints.
    const [opAgg] = await LedgerEntry.aggregate([
      {
        $match: {
          organization_id: orgId,
          side: "debit",
          account: "expense_food",
          posted_at: { $gte: new Date(Date.UTC(2026, 2, 1)), $lt: new Date(Date.UTC(2026, 3, 1)) },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount_cents" } } },
    ]);
    expect(opAgg?.total ?? 0).toBe(snap.finance.operating_expenses_base_cents);
  });

  it("snapshot content hash is deterministic for the same inputs", async () => {
    const orgId = new mongoose.Types.ObjectId();
    await seed(orgId);
    const a = await compileSnapshot({ organization_id: orgId, period_code: "2026-03", compiled_by: "a" });
    const b = await compileSnapshot({ organization_id: orgId, period_code: "2026-03", compiled_by: "b" });
    // compiled_by is OUTSIDE the hash — the hash depends only on the data.
    expect(a.content_hash).toBe(b.content_hash);
  });
});
