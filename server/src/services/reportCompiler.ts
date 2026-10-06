import crypto from "node:crypto";
import mongoose from "mongoose";
import {
  Accomplishment,
  Business,
  Community,
  ExpenseCategory,
  Fund,
  LedgerEntry,
  Project,
} from "@/models/index.js";
import { env } from "@/config/env.js";
import type { ReportSnapshot, ReportPeriodKind } from "@/models/ImpactReport.js";

// =============================================================================
// Report compiler (Phase 9). Produces a frozen snapshot of the public
// projections for a given period. The compiler is pure: given the same
// (period_code, DB state at period_end) it returns a bit-identical
// snapshot (the `content_hash` field is a sha256 of the canonicalised
// numbers so a reviewer can confirm nothing changed between
// finance-sign and approval).
//
// IMPORTANT: this compiler reads ONLY from the collections the public
// projections already read from — ledger_entries, accomplishments
// (state=published), communities (status=active), funds, projects. It
// never joins private tables, and no PII leaves the function.
// =============================================================================

export const COMPILER_VERSION = "phase9.1";

function monthRange(code: string): { start: Date; end: Date; kind: ReportPeriodKind } {
  if (/^\d{4}-\d{2}$/.test(code)) {
    const [yStr, mStr] = code.split("-") as [string, string];
    const y = Number(yStr);
    const m = Number(mStr);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1));
    return { start, end, kind: "month" };
  }
  if (/^\d{4}-Q[1-4]$/.test(code)) {
    const [yStr, qStr] = code.split("-Q") as [string, string];
    const y = Number(yStr);
    const q = Number(qStr);
    const startMonth = (q - 1) * 3;
    const start = new Date(Date.UTC(y, startMonth, 1));
    const end = new Date(Date.UTC(y, startMonth + 3, 1));
    return { start, end, kind: "quarter" };
  }
  if (/^\d{4}$/.test(code)) {
    const y = Number(code);
    return { start: new Date(Date.UTC(y, 0, 1)), end: new Date(Date.UTC(y + 1, 0, 1)), kind: "year" };
  }
  throw new Error("invalid period_code; expected YYYY-MM / YYYY-Qn / YYYY");
}

function canonicalHash(input: unknown): string {
  // Stable key order — critical so hashing isn't dependent on insertion order.
  const seen = new WeakSet<object>();
  const stringify = (v: unknown): string => {
    if (v === null) return "null";
    if (typeof v === "number") return Number.isFinite(v) ? JSON.stringify(v) : "null";
    if (typeof v === "string") return JSON.stringify(v);
    if (typeof v === "boolean") return v ? "true" : "false";
    if (Array.isArray(v)) return "[" + v.map(stringify).join(",") + "]";
    if (typeof v === "object") {
      if (seen.has(v as object)) return "null";
      seen.add(v as object);
      const keys = Object.keys(v as Record<string, unknown>).sort();
      return "{" + keys.map((k) => JSON.stringify(k) + ":" + stringify((v as Record<string, unknown>)[k])).join(",") + "}";
    }
    return "null";
  };
  return crypto.createHash("sha256").update(stringify(input)).digest("hex");
}

export async function compileSnapshot(args: {
  organization_id: mongoose.Types.ObjectId;
  period_code: string;
  compiled_by: string;
}): Promise<ReportSnapshot> {
  const { start, end, kind } = monthRange(args.period_code);
  const orgId = args.organization_id;

  // Finance aggregates — straight from ledger_entries. These match the
  // definitions used in Phase 8 (donations excluded from sustainability).
  const [donationsIn] = await LedgerEntry.aggregate([
    {
      $match: {
        organization_id: orgId,
        side: "credit",
        account: "donations_received",
        posted_at: { $gte: start, $lt: end },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount_cents" } } },
  ]);
  const donations = Number(donationsIn?.total ?? 0);

  const operatingCategoryIds = (
    await ExpenseCategory.find({ organization_id: orgId, is_operating: true }, { _id: 1 }).lean()
  ).map((c) => c._id);
  const programmeCategoryIds = (
    await ExpenseCategory.find({ organization_id: orgId, is_programme: true }, { _id: 1 }).lean()
  ).map((c) => c._id);

  const [opAgg] = await LedgerEntry.aggregate([
    {
      $match: {
        organization_id: orgId,
        side: "debit",
        posted_at: { $gte: start, $lt: end },
        expense_category_id: { $in: operatingCategoryIds },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount_cents" } } },
  ]);
  const [progAgg] = await LedgerEntry.aggregate([
    {
      $match: {
        organization_id: orgId,
        side: "debit",
        posted_at: { $gte: start, $lt: end },
        expense_category_id: { $in: programmeCategoryIds },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount_cents" } } },
  ]);
  const [revAgg] = await LedgerEntry.aggregate([
    {
      $match: {
        organization_id: orgId,
        side: "credit",
        account: "revenue_business",
        posted_at: { $gte: start, $lt: end },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount_cents" } } },
  ]);
  const operating = Number(opAgg?.total ?? 0);
  const programme = Number(progAgg?.total ?? 0);
  const business = Number(revAgg?.total ?? 0);
  const sustainability_ratio = operating > 0 ? business / operating : 0;

  // Fund balances — a point-in-time snapshot "as of" period_end.
  // We compute each fund's net inflow up to period_end so the snapshot
  // doesn't depend on the fund.balance_cents cache (which could drift).
  const funds = await Fund.find({ organization_id: orgId }).sort({ code: 1 }).lean();
  const fundBalances = await Promise.all(
    funds.map(async (f) => {
      const [agg] = await LedgerEntry.aggregate([
        {
          $match: {
            organization_id: orgId,
            fund_id: f._id,
            posted_at: { $lt: end },
            account: { $in: ["cash", /^bank_/, "stripe_clearing"] as unknown as string[] },
          },
        },
        {
          $group: {
            _id: "$side",
            total: { $sum: "$amount_cents" },
          },
        },
      ]);
      void agg;
      // The $in RegExp trick isn't supported — do a two-step compute with a
      // simple account-prefix regex.
      const [debits] = await LedgerEntry.aggregate([
        {
          $match: {
            organization_id: orgId,
            fund_id: f._id,
            posted_at: { $lt: end },
            account: { $regex: "^(cash|bank_|stripe_clearing)" },
            side: "debit",
          },
        },
        { $group: { _id: null, total: { $sum: "$amount_cents" } } },
      ]);
      const [credits] = await LedgerEntry.aggregate([
        {
          $match: {
            organization_id: orgId,
            fund_id: f._id,
            posted_at: { $lt: end },
            account: { $regex: "^(cash|bank_|stripe_clearing)" },
            side: "credit",
          },
        },
        { $group: { _id: null, total: { $sum: "$amount_cents" } } },
      ]);
      const balance = Number(debits?.total ?? 0) - Number(credits?.total ?? 0);
      return {
        code: f.code,
        name: f.name,
        balance_cents: balance,
      };
    })
  );

  // Totals (counts up to period_end). Business dimension gives us a
  // snapshot of how many businesses were actually active at period_end.
  const [projects, communities, accomplishmentsCount, businesses] = await Promise.all([
    Project.countDocuments({
      organization_id: orgId,
      status: { $in: ["active", "completed"] },
      $or: [{ started_on: { $lt: end } }, { started_on: null }],
    }),
    Community.countDocuments({ organization_id: orgId, status: "active", created_at: { $lt: end } }),
    Accomplishment.countDocuments({
      organization_id: orgId,
      state: "published",
      published_at: { $lt: end, $gte: start },
    }),
    Business.countDocuments({
      organization_id: orgId,
      public_visibility: "public",
      status: { $in: ["active", "paused"] },
      created_at: { $lt: end },
    }),
  ]);

  // Published accomplishments in the period (minimal public fields only).
  const accomps = await Accomplishment.find({
    organization_id: orgId,
    state: "published",
    published_at: { $gte: start, $lt: end },
  })
    .sort({ published_at: 1 })
    .limit(100)
    .lean();
  const projectIds = accomps.map((a) => a.project_id).filter((x): x is mongoose.Types.ObjectId => !!x);
  const projs = await Project.find({ _id: { $in: projectIds } }, { slug: 1, community_id: 1 }).lean();
  const projById = new Map(projs.map((p) => [p._id.toString(), p]));
  const commIds = projs.map((p) => p.community_id).filter((x): x is mongoose.Types.ObjectId => !!x);
  const comms = await Community.find({ _id: { $in: commIds } }, { slug: 1, name: 1, region_label: 1 }).lean();
  const commBySlug = new Map(comms.map((c) => [c._id.toString(), c]));

  const accomplishments = accomps
    .filter((a) => a.public_id && a.published_at)
    .map((a) => {
      const p = projById.get(a.project_id!.toString());
      const c = p?.community_id ? commBySlug.get(p.community_id.toString()) : null;
      return {
        public_id: a.public_id!,
        title: a.title,
        occurred_on: (a.occurred_on ?? a.published_at)!.toISOString(),
        project_slug: p?.slug ?? "",
        community_slug: c?.slug ?? "",
      };
    });

  // Community snapshot (coarse coords never leave the Community model —
  // the compiler doesn't include lat/lng in the snapshot).
  const activeComms = await Community.find({
    organization_id: orgId,
    status: "active",
    created_at: { $lt: end },
  }).lean();
  const communitiesList = await Promise.all(
    activeComms.map(async (c) => ({
      slug: c.slug,
      name: c.name,
      region_label: c.region_label,
      active_projects: await Project.countDocuments({
        organization_id: orgId,
        community_id: c._id,
        status: { $in: ["active", "completed", "paused"] },
      }),
    }))
  );

  const base_currency = env.BASE_CURRENCY.toUpperCase();

  const draft: Omit<ReportSnapshot, "content_hash" | "compiled_at" | "compiled_by" | "compiler_version"> = {
    period_kind: kind,
    period_code: args.period_code,
    period_start: start.toISOString(),
    period_end: end.toISOString(),
    totals: {
      projects,
      communities,
      accomplishments: accomplishmentsCount,
      businesses,
    },
    finance: {
      base_currency,
      donations_received_base_cents: donations,
      operating_expenses_base_cents: operating,
      programme_expenses_base_cents: programme,
      business_revenue_base_cents: business,
      sustainability_ratio,
      fund_balances: fundBalances,
    },
    accomplishments,
    communities: communitiesList,
  };

  const content_hash = canonicalHash(draft);

  return {
    ...draft,
    content_hash,
    compiled_at: new Date().toISOString(),
    compiled_by: args.compiled_by,
    compiler_version: COMPILER_VERSION,
  };
}
