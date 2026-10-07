import mongoose from "mongoose";
import {
  AccountingPeriod,
  Donation,
  Fund,
  LedgerEntry,
  Organization,
  Project,
} from "@/models/index.js";

async function primaryOrgId(): Promise<mongoose.Types.ObjectId> {
  const org = await Organization.findOne().sort({ _id: 1 }).select({ _id: 1 }).lean();
  if (!org) throw new Error("no organization");
  return org._id;
}

export type PublicFundingSummary = {
  base_currency: string;
  totals: {
    donations_count: number;
    gross_received_cents: number;
    fees_paid_cents: number;
    net_received_cents: number;
    expenses_cents: number;
    remaining_cents: number;
  };
  by_fund_type: Array<{
    kind: "general" | "project" | "restricted" | "endowment";
    name: string;
    balance_cents: number;
    in_cents: number;
    out_cents: number;
    fund_count: number;
  }>;
  per_project: Array<{
    slug: string;
    name: string;
    raised_cents: number;
    spent_cents: number;
    remaining_cents: number;
  }>;
  recent_donations: Array<{
    public_id: string;
    donor: string;
    amount_cents: number;
    currency: string;
    at: string;
    project_slug: string | null;
  }>;
  closed_periods: Array<{
    code: string;
    gross_cents: number;
    net_cents: number;
    expenses_cents: number;
    closed_at: string;
  }>;
  as_of: string;
};

export async function publicFinanceSummary(
  organization_id?: mongoose.Types.ObjectId
): Promise<PublicFundingSummary> {
  const orgId = organization_id ?? (await primaryOrgId());

  const [donAgg] = await Donation.aggregate([
    {
      $match: {
        organization_id: orgId,
        status: { $in: ["succeeded", "partially_refunded"] },
      },
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        gross: { $sum: "$gross_base_cents" },
        fees: { $sum: "$fee_base_cents" },
        net: { $sum: "$net_base_cents" },
      },
    },
  ]);
  const [expenseAgg] = await LedgerEntry.aggregate([
    {
      $match: {
        organization_id: orgId,
        side: "debit",
        account: { $regex: "^expense_" },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount_cents" } } },
  ]);
  const grossRecv = Number(donAgg?.gross ?? 0);
  const fees = Number(donAgg?.fees ?? 0);
  const netRecv = Number(donAgg?.net ?? 0);
  const expensesTotal = Number(expenseAgg?.total ?? 0);

  const funds = await Fund.find({ organization_id: orgId }).lean();
  const base_currency = funds[0]?.base_currency ?? "USD";
  const remaining = funds.reduce((n, f) => n + Math.max(0, f.balance_cents), 0);

  const byTypeMap = new Map<
    string,
    { kind: "general" | "project" | "restricted" | "endowment"; name: string; balance_cents: number; in_cents: number; out_cents: number; fund_count: number }
  >();
  const KIND_LABEL = {
    general: "Unrestricted (General)",
    project: "Project-tied",
    restricted: "Restricted",
    endowment: "Endowment",
  } as const;
  for (const f of funds) {
    const entry = byTypeMap.get(f.kind) ?? {
      kind: f.kind,
      name: KIND_LABEL[f.kind],
      balance_cents: 0,
      in_cents: 0,
      out_cents: 0,
      fund_count: 0,
    };
    entry.balance_cents += f.balance_cents;
    entry.in_cents += f.total_in_cents;
    entry.out_cents += f.total_out_cents;
    entry.fund_count += 1;
    byTypeMap.set(f.kind, entry);
  }
  const by_fund_type = Array.from(byTypeMap.values()).sort((a, b) => b.balance_cents - a.balance_cents);

  // Per-project — raised = donations tied to project (gross), spent = sum
  // of expense debits that reference project_id.
  const projects = await Project.find({ organization_id: orgId }).select({ _id: 1, slug: 1, name: 1 }).lean();
  const per_project = await Promise.all(
    projects.map(async (p) => {
      const [raisedAgg] = await Donation.aggregate([
        {
          $match: {
            organization_id: orgId,
            project_id: p._id,
            status: { $in: ["succeeded", "partially_refunded"] },
          },
        },
        { $group: { _id: null, total: { $sum: "$net_base_cents" } } },
      ]);
      const [spentAgg] = await LedgerEntry.aggregate([
        {
          $match: {
            organization_id: orgId,
            project_id: p._id,
            side: "debit",
            account: { $regex: "^expense_" },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount_cents" } } },
      ]);
      const raised = Number(raisedAgg?.total ?? 0);
      const spent = Number(spentAgg?.total ?? 0);
      return {
        slug: p.slug,
        name: p.name,
        raised_cents: raised,
        spent_cents: spent,
        remaining_cents: Math.max(0, raised - spent),
      };
    })
  );

  const recent = await Donation.find({
    organization_id: orgId,
    status: { $in: ["succeeded", "partially_refunded"] },
  })
    .sort({ received_at: -1 })
    .limit(10)
    .lean();
  const projectBySlug = new Map(projects.map((p) => [p._id.toString(), p.slug]));
  const recent_donations = recent.map((d) => ({
    public_id: d.public_id ?? "",
    donor: d.anonymous ? "Anonymous" : d.donor_name ?? "Anonymous",
    amount_cents: d.gross_base_cents,
    currency: d.base_currency,
    at: d.received_at.toISOString(),
    project_slug: d.project_id ? projectBySlug.get(d.project_id.toString()) ?? null : null,
  }));

  const closed = await AccountingPeriod.find({
    organization_id: orgId,
    status: "closed",
  })
    .sort({ code: -1 })
    .limit(12)
    .lean();
  const closed_periods = closed
    .filter((p) => p.snapshot)
    .map((p) => ({
      code: p.code,
      gross_cents: p.snapshot!.gross_received_cents,
      net_cents: p.snapshot!.net_received_cents,
      expenses_cents: p.snapshot!.expenses_cents,
      closed_at: p.closed_at ? p.closed_at.toISOString() : p.snapshot!.taken_at.toISOString(),
    }));

  return {
    base_currency,
    totals: {
      donations_count: Number(donAgg?.count ?? 0),
      gross_received_cents: grossRecv,
      fees_paid_cents: fees,
      net_received_cents: netRecv,
      expenses_cents: expensesTotal,
      remaining_cents: remaining,
    },
    by_fund_type,
    per_project,
    recent_donations,
    closed_periods,
    as_of: new Date().toISOString(),
  };
}

export async function publicProjectFunding(
  project_slug: string,
  organization_id?: mongoose.Types.ObjectId
): Promise<{
  slug: string;
  base_currency: string;
  raised_cents: number;
  spent_cents: number;
  remaining_cents: number;
  recent: Array<{ public_id: string; donor: string; amount_cents: number; at: string }>;
} | null> {
  const orgId = organization_id ?? (await primaryOrgId());
  const p = await Project.findOne({ organization_id: orgId, slug: project_slug }).lean();
  if (!p) return null;

  const [raisedAgg] = await Donation.aggregate([
    {
      $match: {
        organization_id: orgId,
        project_id: p._id,
        status: { $in: ["succeeded", "partially_refunded"] },
      },
    },
    { $group: { _id: null, total: { $sum: "$net_base_cents" } } },
  ]);
  const [spentAgg] = await LedgerEntry.aggregate([
    {
      $match: {
        organization_id: orgId,
        project_id: p._id,
        side: "debit",
        account: { $regex: "^expense_" },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount_cents" } } },
  ]);
  const recent = await Donation.find({
    organization_id: orgId,
    project_id: p._id,
    status: { $in: ["succeeded", "partially_refunded"] },
  })
    .sort({ received_at: -1 })
    .limit(5)
    .lean();
  const fund = await Fund.findOne({ organization_id: orgId, project_id: p._id }).lean();
  return {
    slug: p.slug,
    base_currency: fund?.base_currency ?? "USD",
    raised_cents: Number(raisedAgg?.total ?? 0),
    spent_cents: Number(spentAgg?.total ?? 0),
    remaining_cents: Math.max(0, Number(raisedAgg?.total ?? 0) - Number(spentAgg?.total ?? 0)),
    recent: recent.map((d) => ({
      public_id: d.public_id ?? "",
      donor: d.anonymous ? "Anonymous" : d.donor_name ?? "Anonymous",
      amount_cents: d.gross_base_cents,
      at: d.received_at.toISOString(),
    })),
  };
}
