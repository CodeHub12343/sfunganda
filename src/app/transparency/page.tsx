import type { Metadata } from "next";
import Link from "next/link";
import { api } from "@/lib/api";

export const metadata: Metadata = {
  title: "Transparency — Sarah's Foundation",
  description: "Where donations go, project by project.",
};

type Summary = {
  base_currency: string;
  totals: {
    donations_count: number;
    gross_received_cents: number;
    fees_paid_cents: number;
    net_received_cents: number;
    expenses_cents: number;
    remaining_cents: number;
  };
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
  as_of: string;
};

function money(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default async function TransparencyPage() {
  let data: Summary | null = null;
  try {
    data = await api<Summary>("/public/finance", {
      tags: ["public:finance", "public:transparency"],
      revalidate: 180,
    });
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "3rem 1.25rem 5rem" }}>
        <h1>Transparency</h1>
        <p>Financial data is not available right now.</p>
      </main>
    );
  }

  const spentPct =
    data.totals.gross_received_cents > 0
      ? Math.round((data.totals.expenses_cents / data.totals.net_received_cents) * 100)
      : 0;

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "3rem 1.25rem 5rem" }}>
      <h1 style={{ fontSize: "2.25rem", marginBottom: "0.4rem" }}>Transparency</h1>
      <p style={{ color: "#6b7280" }}>
        As of {new Date(data.as_of).toLocaleString()} · {data.base_currency} is our reporting currency.
      </p>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
          margin: "1.5rem 0",
        }}
      >
        <Tile label="Donations received" value={money(data.totals.gross_received_cents, data.base_currency)} />
        <Tile label="Processor fees" value={money(data.totals.fees_paid_cents, data.base_currency)} />
        <Tile label="Net received" value={money(data.totals.net_received_cents, data.base_currency)} />
        <Tile label="Expenses posted" value={money(data.totals.expenses_cents, data.base_currency)} />
        <Tile label="Remaining to spend" value={money(data.totals.remaining_cents, data.base_currency)} />
        <Tile label="Donations count" value={Intl.NumberFormat().format(data.totals.donations_count)} />
      </section>

      <section>
        <h2>Where it went</h2>
        <p style={{ color: "#6b7280" }}>
          About <strong>{spentPct}%</strong> of net donations have been spent against projects.
        </p>
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.75rem" }}>
          {data.per_project.map((p) => (
            <li key={p.slug} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                <h3 style={{ margin: 0, fontSize: "1rem" }}>
                  <Link href={`/projects/${p.slug}`}>{p.name}</Link>
                </h3>
                <small style={{ color: "#6b7280" }}>
                  raised {money(p.raised_cents, data!.base_currency)} · spent{" "}
                  {money(p.spent_cents, data!.base_currency)} · remaining{" "}
                  {money(p.remaining_cents, data!.base_currency)}
                </small>
              </div>
              <ProgressBar
                value={
                  p.raised_cents > 0
                    ? Math.min(100, Math.round((p.spent_cents / p.raised_cents) * 100))
                    : 0
                }
              />
            </li>
          ))}
          {data.per_project.length === 0 ? (
            <li style={card}>No project funding yet.</li>
          ) : null}
        </ul>
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Recent donations</h2>
        {data.recent_donations.length === 0 ? (
          <p style={{ color: "#6b7280" }}>No donations yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {data.recent_donations.map((d) => (
              <li
                key={d.public_id}
                style={{
                  padding: "0.75rem 1rem",
                  borderBottom: "1px solid #e5e7eb",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "1rem",
                }}
              >
                <div>
                  <strong>{d.donor}</strong>
                  {d.project_slug ? (
                    <>
                      {" "}
                      — <Link href={`/projects/${d.project_slug}`}>{d.project_slug}</Link>
                    </>
                  ) : null}
                </div>
                <small style={{ color: "#6b7280" }}>
                  {money(d.amount_cents, d.currency)} ·{" "}
                  {new Date(d.at).toLocaleDateString()}
                </small>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ ...card, textAlign: "center" }}>
      <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{value}</div>
      <small style={{ color: "#6b7280" }}>{label}</small>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        marginTop: "0.4rem",
        background: "#e5e7eb",
        borderRadius: 999,
        height: 6,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${value}%`,
          height: "100%",
          background: "linear-gradient(90deg, #f59e0b, #ef4444)",
        }}
      />
    </div>
  );
}

const card: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: "0.9rem 1.1rem",
  background: "#fff",
};
