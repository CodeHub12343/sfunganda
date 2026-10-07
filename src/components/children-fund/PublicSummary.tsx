"use client";

import { useEffect, useState } from "react";

// =============================================================================
// Public children's-fund summary block (§13.7). Hits
// GET /api/v1/public/children-fund/summary. Renders:
//   • an aggregate figure + beneficiary count when the k-anonymity
//     threshold is met;
//   • a plain-language suppression notice otherwise.
// Never fetches or displays any per-child information.
// =============================================================================

type Payload =
  | {
      enabled: false;
      suppressed: true;
      reason: string;
    }
  | {
      enabled: true;
      suppressed: true;
      reason: string;
      base_currency: string;
      threshold: number;
      updated_at: string | null;
    }
  | {
      enabled: true;
      suppressed: false;
      base_currency: string;
      total_in_cents: number;
      total_out_cents: number;
      balance_cents: number;
      beneficiary_count: number;
      threshold: number;
      updated_at: string;
    };

function fmt(cents: number, currency: string) {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency });
}

export function ChildrensFundSummary() {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/v1/public/children-fund/summary");
        if (!r.ok) throw new Error(`http ${r.status}`);
        const j = (await r.json()) as { data: Payload };
        if (!cancelled) setData(j.data);
      } catch {
        if (!cancelled) setErr("summary unavailable");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (err || !data) return null;
  if (!data.enabled) return null; // Nothing to show until operations enable it.

  return (
    <aside
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: "1rem 1.25rem",
        background: "#f9fafb",
        margin: "1rem 0",
      }}
    >
      <h3 style={{ marginTop: 0 }}>Children's future fund</h3>
      {data.suppressed ? (
        <p style={{ margin: 0, color: "#6b7280" }}>
          Totals are not shown while fewer than {("threshold" in data ? data.threshold : 5)}{" "}
          children are participating — a privacy safeguard that prevents individual
          figures being inferred. {data.reason}.
        </p>
      ) : (
        <>
          <p style={{ margin: 0 }}>
            <strong>{fmt(data.balance_cents, data.base_currency)}</strong> currently
            saved for {data.beneficiary_count} children. All figures aggregate across
            the group — no per-child record is published.
          </p>
          <dl style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "0.25rem 1rem", margin: "0.75rem 0 0", color: "#374151", fontSize: "0.9rem" }}>
            <dt>Received</dt>
            <dd>{fmt(data.total_in_cents, data.base_currency)}</dd>
            <dt>Distributed</dt>
            <dd>{fmt(data.total_out_cents, data.base_currency)}</dd>
            <dt>As of</dt>
            <dd>{new Date(data.updated_at).toLocaleDateString()}</dd>
          </dl>
        </>
      )}
    </aside>
  );
}
