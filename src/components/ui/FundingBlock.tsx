import { api } from "@/lib/api";

type Funding = {
  slug: string;
  base_currency: string;
  raised_cents: number;
  spent_cents: number;
  remaining_cents: number;
  recent: Array<{ public_id: string; donor: string; amount_cents: number; at: string }>;
};

function money(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

// Server component — renders a project-scoped funding block. Returns null
// when the project has no funding row yet, so callers can conditionally
// include it without a layout gap.
export async function FundingBlock({ projectSlug }: { projectSlug: string }) {
  let data: Funding | null = null;
  try {
    data = await api<Funding>(`/public/finance/projects/${projectSlug}`, {
      tags: ["public:finance", `public:finance:project:${projectSlug}`],
      revalidate: 180,
    });
  } catch {
    data = null;
  }
  if (!data) return null;

  const pct =
    data.raised_cents > 0 ? Math.min(100, Math.round((data.spent_cents / data.raised_cents) * 100)) : 0;

  return (
    <section
      aria-label="Project funding"
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: "1rem 1.25rem",
        background: "#fff",
        margin: "1.5rem 0",
      }}
    >
      <h3 style={{ margin: 0 }}>Funding</h3>
      <div style={{ marginTop: "0.4rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <small>
          Raised: <strong>{money(data.raised_cents, data.base_currency)}</strong>
        </small>
        <small>
          Spent: <strong>{money(data.spent_cents, data.base_currency)}</strong>
        </small>
        <small>
          Remaining: <strong>{money(data.remaining_cents, data.base_currency)}</strong>
        </small>
      </div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          background: "#e5e7eb",
          borderRadius: 999,
          height: 6,
          overflow: "hidden",
          margin: "0.6rem 0 0.2rem",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "linear-gradient(90deg, #f59e0b, #ef4444)",
          }}
        />
      </div>
      {data.recent.length > 0 ? (
        <details style={{ marginTop: "0.5rem" }}>
          <summary style={{ cursor: "pointer", color: "#6b7280", fontSize: "0.85rem" }}>
            Recent donors
          </summary>
          <ul style={{ listStyle: "none", padding: 0, margin: "0.4rem 0 0" }}>
            {data.recent.map((r) => (
              <li key={r.public_id} style={{ fontSize: "0.85rem", color: "#374151" }}>
                {r.donor} · {money(r.amount_cents, data!.base_currency)} ·{" "}
                {new Date(r.at).toLocaleDateString()}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
