import mongoose from "mongoose";
import { LedgerEntry, ExpenseCategory, Business, Community } from "@/models/index.js";
import { AppError } from "@/util/errors.js";

// =============================================================================
// Sustainability (Phase 8). The percentage the public sustainability page
// shows for a month is:
//
//   sustainability_ratio(month) = business_operating_revenue(month)
//                                 ─────────────────────────────────
//                                 operating_expenses(month)
//
// Rules carried from the blueprint:
//
// 1. The numerator is credit-side ledger_entries on account
//    `revenue_business` (business sales). It is NEVER donations —
//    `donations_received` and `contribution_*` are excluded, and this file
//    has a dedicated test that fails if a donation leaks in (§Phase 8
//    testing).
// 2. The denominator is debit-side ledger_entries on `expense_*` accounts
//    whose matching expense_category_id is flagged `is_operating`. Programme
//    expenses never appear here.
// 3. Figures are in base-currency cents and ALWAYS come straight off the
//    ledger (the hash-chained, insert-only collection) — so the figure the
//    site shows for a month can be hand-recomputed from the listed rows
//    (§Phase 8 definition of done).
// =============================================================================

export type MonthlySustainability = {
  month: string; // "YYYY-MM"
  revenue_base_cents: number;
  operating_expense_base_cents: number;
  ratio: number; // revenue / operating_expense; 0 when the denominator is 0
  // The rows the number was built from, exposed for the public-facing
  // "recompute by hand" audit trail. Trimmed to the first 500 of each
  // side; a paged endpoint is available if operations needs more.
  revenue_rows: SustainabilityRow[];
  expense_rows: SustainabilityRow[];
};

export type SustainabilityRow = {
  seq: number;
  posted_at: string;
  amount_cents: number;
  account: string;
  business_id: string | null;
  expense_category_id: string | null;
  project_id: string | null;
  transaction_public_id: string | null;
};

function monthRange(month: string): { start: Date; end: Date } {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new AppError("bad_request", "month must be YYYY-MM");
  const [yStr, mStr] = month.split("-") as [string, string];
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) {
    throw new AppError("bad_request", "invalid month");
  }
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1, 0, 0, 0));
  return { start, end };
}

function toRow(e: {
  seq: number;
  posted_at: Date;
  amount_cents: number;
  account: string;
  business_id?: mongoose.Types.ObjectId | null;
  expense_category_id?: mongoose.Types.ObjectId | null;
  project_id?: mongoose.Types.ObjectId | null;
  transaction_public_id?: string | null;
}): SustainabilityRow {
  return {
    seq: e.seq,
    posted_at: e.posted_at.toISOString(),
    amount_cents: e.amount_cents,
    account: e.account,
    business_id: e.business_id ? e.business_id.toString() : null,
    expense_category_id: e.expense_category_id ? e.expense_category_id.toString() : null,
    project_id: e.project_id ? e.project_id.toString() : null,
    transaction_public_id: e.transaction_public_id ?? null,
  };
}

export async function sustainabilityForMonth(
  organization_id: mongoose.Types.ObjectId,
  month: string
): Promise<MonthlySustainability> {
  const { start, end } = monthRange(month);

  // 1. Revenue — credit-side rows on revenue_business.
  const revenueRows = await LedgerEntry.find({
    organization_id,
    side: "credit",
    account: "revenue_business",
    posted_at: { $gte: start, $lt: end },
  })
    .sort({ seq: 1 })
    .limit(500)
    .lean();

  const revenue_base_cents = (
    await LedgerEntry.aggregate([
      {
        $match: {
          organization_id,
          side: "credit",
          account: "revenue_business",
          posted_at: { $gte: start, $lt: end },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount_cents" } } },
    ])
  )[0]?.total ?? 0;

  // 2. Operating expenses — debit-side expense_* rows where the
  //    expense_category is flagged is_operating. We fetch the operating
  //    categories first and filter the ledger walk by id — this is tighter
  //    than any account-prefix heuristic.
  const operatingCategoryIds = (
    await ExpenseCategory.find({ organization_id, is_operating: true }, { _id: 1 }).lean()
  ).map((c) => c._id);

  const operating_expense_base_cents =
    operatingCategoryIds.length === 0
      ? 0
      : (
          await LedgerEntry.aggregate([
            {
              $match: {
                organization_id,
                side: "debit",
                posted_at: { $gte: start, $lt: end },
                expense_category_id: { $in: operatingCategoryIds },
              },
            },
            { $group: { _id: null, total: { $sum: "$amount_cents" } } },
          ])
        )[0]?.total ?? 0;

  const expenseRows =
    operatingCategoryIds.length === 0
      ? []
      : await LedgerEntry.find({
          organization_id,
          side: "debit",
          posted_at: { $gte: start, $lt: end },
          expense_category_id: { $in: operatingCategoryIds },
        })
          .sort({ seq: 1 })
          .limit(500)
          .lean();

  return {
    month,
    revenue_base_cents,
    operating_expense_base_cents,
    ratio: operating_expense_base_cents > 0 ? revenue_base_cents / operating_expense_base_cents : 0,
    revenue_rows: revenueRows.map(toRow),
    expense_rows: expenseRows.map(toRow),
  };
}

// Public sustainability projection — one or many months, filtered to a
// community (via business.community_id) when `community_slug` is given.
export async function publicSustainability(args: {
  organization_id: mongoose.Types.ObjectId;
  months?: string[]; // explicit months, else last 12
  community_slug?: string | null;
}): Promise<{
  months: MonthlySustainability[];
  community: { slug: string; name: string } | null;
  cache_tags: string[];
}> {
  const months = args.months && args.months.length > 0 ? args.months : last12Months();
  let community: { slug: string; name: string } | null = null;

  // If a community is specified, we filter revenue and expense rows by
  // business_id ∈ that community. For now we don't require community-filter
  // because programme expenses lack a direct community dimension — the
  // ratio there is business-only (revenue_business JOIN business.community_id).
  if (args.community_slug) {
    const c = await Community.findOne({ organization_id: args.organization_id, slug: args.community_slug }).lean();
    if (!c) throw new AppError("not_found", "community not found");
    community = { slug: c.slug, name: c.name };
  }

  const businessesInCommunity = community
    ? (
        await Business.find(
          { organization_id: args.organization_id, community_id: (await Community.findOne({ slug: community.slug }).lean())!._id },
          { _id: 1 }
        ).lean()
      ).map((b) => b._id)
    : null;

  const monthData: MonthlySustainability[] = [];
  for (const month of months) {
    const base = await sustainabilityForMonth(args.organization_id, month);
    if (businessesInCommunity) {
      base.revenue_rows = base.revenue_rows.filter((r) =>
        r.business_id ? businessesInCommunity.some((b) => b.toString() === r.business_id) : false
      );
      base.revenue_base_cents = base.revenue_rows.reduce((s, r) => s + r.amount_cents, 0);
      // Operating expenses in a community-only slice are expenses whose
      // business_id ∈ community; those that are community-wide stay in the
      // org-level numbers.
      base.expense_rows = base.expense_rows.filter((r) =>
        r.business_id ? businessesInCommunity.some((b) => b.toString() === r.business_id) : false
      );
      base.operating_expense_base_cents = base.expense_rows.reduce((s, r) => s + r.amount_cents, 0);
      base.ratio =
        base.operating_expense_base_cents > 0
          ? base.revenue_base_cents / base.operating_expense_base_cents
          : 0;
    }
    monthData.push(base);
  }

  return {
    months: monthData,
    community,
    cache_tags: ["public:sustainability", community ? `public:sustainability:${community.slug}` : "public:sustainability:org"],
  };
}

function last12Months(): string[] {
  const out: string[] = [];
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0..11
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

// Community summary (Phase 8). Coarse coordinates only — the one-decimal
// snap in the Community model is also enforced here as defence in depth.
export async function communityWithCoarseCoords(
  organization_id: mongoose.Types.ObjectId,
  slug: string
): Promise<{
  slug: string;
  name: string;
  region_label: string;
  summary: string;
  public_lat: number | null;
  public_lng: number | null;
  businesses: Array<{ slug: string; name: string; kind: string; status: string }>;
} | null> {
  const c = await Community.findOne({ organization_id, slug, status: "active" }).lean();
  if (!c) return null;
  const bizs = await Business.find({
    organization_id,
    community_id: c._id,
    public_visibility: "public",
    status: { $in: ["active", "paused"] },
  }).lean();
  // Final belt-and-braces coordinate rounding.
  const roundCoarse = (v: number | null | undefined) =>
    v === null || v === undefined ? null : Math.round(v * 10) / 10;
  return {
    slug: c.slug,
    name: c.name,
    region_label: c.region_label,
    summary: c.summary,
    public_lat: roundCoarse(c.public_lat),
    public_lng: roundCoarse(c.public_lng),
    businesses: bizs.map((b) => ({ slug: b.slug, name: b.name, kind: b.kind, status: b.status })),
  };
}
