import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { startTestDB, stopTestDB, clearTestDB } from "./setup.js";
import { LedgerEntry, ExpenseCategory } from "../src/models/index.js";
import { sustainabilityForMonth } from "../src/services/sustainability.js";

// =============================================================================
// Phase 8 testing: "ratio excludes donations".
//
// We seed one month of ledger_entries directly: a business revenue row, a
// donation inflow row (on `donations_received`), and an operating-flagged
// expense row. The sustainability call must count the business revenue in the
// numerator — but NEVER the donation — and must count the operating expense
// in the denominator. Any drift here is a public-trust failure.
// =============================================================================

async function seed(orgId: mongoose.Types.ObjectId): Promise<void> {
  const operating = await ExpenseCategory.create({
    organization_id: orgId,
    slug: "operating-food",
    name: "Operating · Food",
    is_operating: true,
    is_programme: false,
  });
  const nonOperating = await ExpenseCategory.create({
    organization_id: orgId,
    slug: "programme-care",
    name: "Programme · Care",
    is_operating: false,
    is_programme: true,
  });
  // Seed a few rows in a chain-ignorant way — we don't exercise the hash
  // chain in this test; we only test the aggregation.
  const base = new Date(Date.UTC(2026, 2, 15)); // 2026-03-15
  const common = {
    organization_id: orgId,
    base_currency: "USD",
    transaction_id: new mongoose.Types.ObjectId(),
    posted_at: base,
    prev_hash: "x".repeat(64),
    hash: "" as string,
  };
  const rows = [
    { seq: 1, side: "credit", account: "revenue_business", amount_cents: 50_000, memo: "egg sales", business_id: new mongoose.Types.ObjectId() },
    { seq: 2, side: "credit", account: "donations_received", amount_cents: 100_000, memo: "donor" },
    { seq: 3, side: "debit", account: "expense_food", amount_cents: 20_000, memo: "feed", expense_category_id: operating._id },
    { seq: 4, side: "debit", account: "expense_care", amount_cents: 15_000, memo: "programme supplies", expense_category_id: nonOperating._id },
  ];
  for (const r of rows) {
    await LedgerEntry.create({ ...common, ...r, hash: `${r.seq}`.padStart(64, "0") } as unknown as Record<string, unknown>);
  }
}

describe("sustainability ratio", () => {
  beforeAll(async () => {
    await startTestDB();
  });
  afterAll(async () => {
    await stopTestDB();
  });
  beforeEach(async () => {
    await clearTestDB();
  });

  it("excludes donations from revenue and non-operating categories from expenses", async () => {
    const orgId = new mongoose.Types.ObjectId();
    await seed(orgId);
    const r = await sustainabilityForMonth(orgId, "2026-03");
    expect(r.revenue_base_cents).toBe(50_000); // business revenue only
    expect(r.operating_expense_base_cents).toBe(20_000); // operating only
    expect(r.ratio).toBeCloseTo(2.5, 10);

    // Hand-recompute from the exposed rows (Phase 8 definition of done).
    const sumRows = r.revenue_rows.reduce((s, row) => s + row.amount_cents, 0);
    const sumExpenses = r.expense_rows.reduce((s, row) => s + row.amount_cents, 0);
    expect(sumRows).toBe(r.revenue_base_cents);
    expect(sumExpenses).toBe(r.operating_expense_base_cents);

    // Explicit guard: no donation row leaked into the revenue rows.
    for (const row of r.revenue_rows) {
      expect(row.account).not.toBe("donations_received");
      expect(row.account.startsWith("contribution_")).toBe(false);
    }
  });

  it("returns zero when no business revenue exists", async () => {
    const orgId = new mongoose.Types.ObjectId();
    const r = await sustainabilityForMonth(orgId, "2026-03");
    expect(r.revenue_base_cents).toBe(0);
    expect(r.operating_expense_base_cents).toBe(0);
    expect(r.ratio).toBe(0);
  });
});
