import mongoose from "mongoose";
import { ExchangeRate } from "@/models/index.js";
import { env } from "@/config/env.js";
import { AppError } from "@/util/errors.js";
import { log } from "@/util/log.js";

function dateOnlyUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function latestRate(
  organization_id: mongoose.Types.ObjectId,
  from: string,
  to: string,
  on: Date
): Promise<number> {
  if (from.toUpperCase() === to.toUpperCase()) return 1;
  const row = await ExchangeRate.findOne({
    organization_id,
    from_currency: from.toUpperCase(),
    to_currency: to.toUpperCase(),
    on_date: { $lte: dateOnlyUtc(on) },
  })
    .sort({ on_date: -1 })
    .lean();
  if (!row) throw new AppError("unavailable", `no FX rate ${from}->${to} on or before ${on.toISOString().slice(0, 10)}`);
  return row.rate;
}

export async function convertToBase(
  organization_id: mongoose.Types.ObjectId,
  cents: number,
  from: string,
  on: Date
): Promise<{ base_cents: number; rate: number }> {
  const base = env.BASE_CURRENCY.toUpperCase();
  const f = from.toUpperCase();
  if (f === base) return { base_cents: cents, rate: 1 };
  const rate = await latestRate(organization_id, f, base, on);
  return { base_cents: Math.round(cents * rate), rate };
}

export async function recordRate(
  organization_id: mongoose.Types.ObjectId,
  input: { from: string; to: string; rate: number; on_date: Date; source?: string }
): Promise<void> {
  const doc = {
    organization_id,
    from_currency: input.from.toUpperCase(),
    to_currency: input.to.toUpperCase(),
    on_date: dateOnlyUtc(input.on_date),
    rate: input.rate,
    source: input.source ?? env.FX_RATE_SOURCE_NAME,
    fetched_at: new Date(),
  };
  try {
    await ExchangeRate.create(doc);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      // Already have this day's rate — reuse it.
      return;
    }
    throw err;
  }
}

// Nightly cron entry — refreshes today's rate for every pair in `pairs`.
// If no source is configured we skip (dev path); the stored rates remain
// authoritative until an operator records new ones manually.
export async function refreshRates(
  organization_id: mongoose.Types.ObjectId,
  pairs: Array<{ from: string; to: string }>
): Promise<number> {
  if (!env.FX_RATE_SOURCE_URL) {
    log.info({ pairs: pairs.length }, "fx.refresh.no_source");
    return 0;
  }
  let saved = 0;
  for (const p of pairs) {
    const url = env.FX_RATE_SOURCE_URL
      .replace("{from}", p.from.toUpperCase())
      .replace("{to}", p.to.toUpperCase());
    try {
      const res = await fetch(url);
      if (!res.ok) {
        log.warn({ status: res.status, pair: p }, "fx.refresh.bad_status");
        continue;
      }
      const json = (await res.json().catch(() => ({}))) as {
        rate?: number;
        rates?: Record<string, number>;
        date?: string;
      };
      const rate = typeof json.rate === "number" ? json.rate : json.rates?.[p.to.toUpperCase()];
      if (typeof rate !== "number" || !isFinite(rate) || rate <= 0) {
        log.warn({ pair: p, body: json }, "fx.refresh.bad_rate");
        continue;
      }
      const date = json.date ? new Date(json.date) : new Date();
      await recordRate(organization_id, { from: p.from, to: p.to, rate, on_date: date });
      saved++;
    } catch (err) {
      log.warn({ pair: p, err: (err as Error).message }, "fx.refresh.error");
    }
  }
  return saved;
}
