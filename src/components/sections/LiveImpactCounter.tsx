import { ImpactCounter } from "./ImpactCounter";
import { impactStats as fallback } from "@/data/content";

// =============================================================================
// Server wrapper around ImpactCounter. Pulls the real "approved and
// published" totals from /public/impact and net finance from
// /public/finance, then hands them to the existing animated counters.
//
// Trust is the point of this organisation (§6 — "Transparency")
// and the hardcoded `30+` is a liability as soon as it drifts from
// reality. If the API is unreachable we fall back to content.ts so a
// cold deploy or local-dev-without-API doesn't blank the page.
//
// Each fetch runs under a 2-second AbortController so a hung Express
// process can't block the server render. The parent <Suspense> catches
// a thrown error and renders the ImpactCounter fallback.
// =============================================================================

type Totals = { projects: number; communities: number; accomplishments: number };
type ImpactData = { totals: Totals; metrics: Array<{ key: string; label: string; unit: string; value: number }> };
type FinanceData = {
  base_currency: string;
  totals: { net_received_cents: number; donations_count: number };
};

async function safeFetch<T>(path: string): Promise<T | null> {
  const origin = process.env.API_ORIGIN;
  if (!origin) return null;
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 2000);
  try {
    const r = await fetch(`${origin}/v1${path}`, {
      signal: ctl.signal,
      headers: process.env.INTERNAL_PROXY_SECRET
        ? { "x-internal-secret": process.env.INTERNAL_PROXY_SECRET }
        : undefined,
      next: { revalidate: 300, tags: ["public:impact", "public:finance"] },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { data?: T };
    return j.data ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(to);
  }
}

export async function LiveImpactCounter() {
  const [impact, finance] = await Promise.all([
    safeFetch<ImpactData>("/public/impact"),
    safeFetch<FinanceData>("/public/finance"),
  ]);

  // If both calls failed, keep the existing hero-stats static block.
  if (!impact && !finance) return <ImpactCounter />;

  const stats = buildStats(impact, finance);
  return <ImpactCounter stats={stats} />;
}

function buildStats(impact: ImpactData | null, finance: FinanceData | null) {
  const out: typeof fallback = [];
  if (impact?.totals.accomplishments != null) {
    out.push({
      value: impact.totals.accomplishments,
      label: "Published updates",
      detail: "approved by a director and verified against evidence.",
      suffix: "",
    });
  } else {
    out.push(fallback[0]!);
  }
  // Founding year — not available from the API; keep static.
  out.push(fallback[1]!);
  if (impact?.totals.communities != null) {
    out.push({
      value: impact.totals.communities,
      label: "Communities served",
      detail: "each one plotted on the map and reported on quarterly.",
      suffix: "",
    });
  } else {
    out.push(fallback[2]!);
  }
  if (finance?.totals?.net_received_cents != null) {
    out.push({
      value: Math.round(finance.totals.net_received_cents / 100),
      label: "Received to date",
      detail: `${finance.base_currency}, net of processor fees; every entry is in the public ledger.`,
      prefix: finance.base_currency === "USD" ? "$" : "",
      suffix: "",
    });
  } else {
    out.push(fallback[3]!);
  }
  return out;
}
