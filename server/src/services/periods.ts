import mongoose from "mongoose";
import { AccountingPeriod, Fund } from "@/models/index.js";
import type { AccountingPeriodDoc, PeriodStatus } from "@/models/AccountingPeriod.js";
import { AppError } from "@/util/errors.js";
import { can, type Actor } from "@/policy/index.js";

export function periodCodeFor(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthBounds(code: string): { starts_on: Date; ends_on: Date } {
  const [y, m] = code.split("-").map(Number);
  if (!y || !m) throw new AppError("bad_request", "bad period code");
  const starts_on = new Date(Date.UTC(y, m - 1, 1));
  const ends_on = new Date(Date.UTC(y, m, 1));
  return { starts_on, ends_on };
}

export async function ensurePeriod(
  organization_id: mongoose.Types.ObjectId,
  code: string
): Promise<AccountingPeriodDoc> {
  const { starts_on, ends_on } = monthBounds(code);
  const doc = await AccountingPeriod.findOneAndUpdate(
    { organization_id, code },
    {
      $setOnInsert: {
        organization_id,
        code,
        starts_on,
        ends_on,
        status: "open",
        reopened_count: 0,
      },
    },
    { upsert: true, new: true }
  );
  return doc.toObject();
}

// Called from the ledger service inside the post txn. If the target period
// is pending_close or closed, the post is rejected.
export async function assertPeriodWritable(
  organization_id: mongoose.Types.ObjectId,
  occurred_on: Date,
  session?: mongoose.ClientSession
): Promise<string> {
  const code = periodCodeFor(occurred_on);
  const q = AccountingPeriod.findOne({ organization_id, code });
  const period = session ? await q.session(session).lean() : await q.lean();
  if (!period) {
    const { starts_on, ends_on } = monthBounds(code);
    // Lazily create the period as "open" when none exists yet. We don't need
    // withTransaction here because the enclosing session already has one.
    await AccountingPeriod.create(
      [
        {
          organization_id,
          code,
          starts_on,
          ends_on,
          status: "open",
          reopened_count: 0,
        },
      ],
      session ? { session } : {}
    );
    return code;
  }
  if (period.status !== "open") {
    throw new AppError("conflict", `period ${code} is ${period.status}; postings are blocked`, {
      fields: { period: period.status },
    });
  }
  return code;
}

export async function listPeriods(actor: Actor, limit = 24): Promise<AccountingPeriodDoc[]> {
  if (!can(actor, "finance.read", { kind: "finance", organization_id: actor.organization_id }))
    throw new AppError("forbidden", "cannot list periods");
  return AccountingPeriod.find({
    organization_id: new mongoose.Types.ObjectId(actor.organization_id),
  })
    .sort({ code: -1 })
    .limit(limit)
    .lean<AccountingPeriodDoc[]>();
}

export async function openPeriod(actor: Actor, code: string): Promise<AccountingPeriodDoc> {
  if (!can(actor, "finance.write", { kind: "finance", organization_id: actor.organization_id }))
    throw new AppError("forbidden", "cannot open period");
  return ensurePeriod(new mongoose.Types.ObjectId(actor.organization_id), code);
}

export async function setPeriodStatus(
  actor: Actor,
  code: string,
  status: PeriodStatus,
  version: number
): Promise<AccountingPeriodDoc> {
  if (!can(actor, "finance.write", { kind: "finance", organization_id: actor.organization_id }))
    throw new AppError("forbidden", "cannot update period");
  const orgId = new mongoose.Types.ObjectId(actor.organization_id);
  const current = await AccountingPeriod.findOne({ organization_id: orgId, code });
  if (!current) throw new AppError("not_found", "period not found");
  if (current.version !== version)
    throw new AppError("version_conflict", "period changed since you loaded it");

  // Legal transitions: open -> pending_close -> closed, closed -> open
  // (reopen; increments counter), pending_close -> open.
  const legal: Record<PeriodStatus, PeriodStatus[]> = {
    open: ["pending_close"],
    pending_close: ["open", "closed"],
    closed: ["open"],
  };
  if (!legal[current.status].includes(status)) {
    throw new AppError("conflict", `cannot move ${current.status} -> ${status}`);
  }

  const uid = new mongoose.Types.ObjectId(actor.user_id);

  if (status === "closed") {
    // Snapshot totals.
    const funds = await Fund.find({ organization_id: orgId }).lean();
    const by_fund: Record<string, { balance_cents: number; in_cents: number; out_cents: number }> = {};
    let gross = 0;
    let net = 0;
    let fees = 0;
    let expenses = 0;
    for (const f of funds) {
      by_fund[f.code] = {
        balance_cents: f.balance_cents,
        in_cents: f.total_in_cents,
        out_cents: f.total_out_cents,
      };
      // Approximate for the snapshot — the integrity job provides the
      // reconciled figures. These are stored for diff checks on reopen.
    }
    const { Donation, LedgerEntry } = await import("@/models/index.js");
    const [donAgg] = await Donation.aggregate([
      {
        $match: {
          organization_id: orgId,
          status: { $in: ["succeeded", "partially_refunded"] },
          received_at: { $gte: current.starts_on, $lt: current.ends_on },
        },
      },
      {
        $group: {
          _id: null,
          gross: { $sum: "$gross_base_cents" },
          net: { $sum: "$net_base_cents" },
          fees: { $sum: "$fee_base_cents" },
        },
      },
    ]);
    const [expAgg] = await LedgerEntry.aggregate([
      {
        $match: {
          organization_id: orgId,
          side: "debit",
          account: { $regex: "^expense_" },
          posted_at: { $gte: current.starts_on, $lt: current.ends_on },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount_cents" } } },
    ]);
    gross = Number(donAgg?.gross ?? 0);
    net = Number(donAgg?.net ?? 0);
    fees = Number(donAgg?.fees ?? 0);
    expenses = Number(expAgg?.total ?? 0);

    current.snapshot = {
      gross_received_cents: gross,
      fees_cents: fees,
      net_received_cents: net,
      expenses_cents: expenses,
      by_fund,
      base_currency: funds[0]?.base_currency ?? "USD",
      taken_at: new Date(),
    };
    current.closed_by = uid;
    current.closed_at = new Date();
  }
  if (status === "open" && current.status === "closed") {
    current.reopened_count += 1;
  }
  current.status = status;
  current.version += 1;
  await current.save();
  return current.toObject();
}
