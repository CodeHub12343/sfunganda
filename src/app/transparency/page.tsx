import type { Metadata } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import { ChildrensFundSummary } from "@/components/children-fund/PublicSummary";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PublicPageHero } from "@/components/layout/PublicPageHero";
import { Container, Section } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Transparency — Sarah's Foundation",
  description: "Where donations go, project by project.",
};

export const dynamic = "force-dynamic";

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
  by_fund_type: Array<{
    kind: string;
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
      <>
        <Navbar />
        <main>
          <PublicPageHero
            eyebrow="Where it goes"
            title="Transparency"
            description="Financial data is not available right now."
          />
        </main>
        <Footer />
      </>
    );
  }

  const spentPct =
    data.totals.gross_received_cents > 0
      ? Math.round((data.totals.expenses_cents / data.totals.net_received_cents) * 100)
      : 0;

  return (
    <>
      <Navbar />
      <main>
        <PublicPageHero
          eyebrow="Where it goes"
          title="Every dollar, accounted for"
          description={`As of ${new Date(data.as_of).toLocaleString()} · ${data.base_currency} is our reporting currency.`}
        />
        <Section>
          <Container>
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

      <ChildrensFundSummary />

      <section aria-label="By fund type">
        <h2>By fund type</h2>
        <p style={{ color: "#6b7280" }}>
          How the balance is partitioned across unrestricted, project-tied, restricted, and endowment funds. Charts use the same numbers as the table below for comparison.
        </p>
        <FundTypeChart items={data.by_fund_type} currency={data.base_currency} />
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem", fontSize: "0.9rem" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={{ padding: "0.4rem" }}>Fund type</th>
              <th style={{ padding: "0.4rem", textAlign: "right" }}>Balance</th>
              <th style={{ padding: "0.4rem", textAlign: "right" }}>Received</th>
              <th style={{ padding: "0.4rem", textAlign: "right" }}>Spent</th>
              <th style={{ padding: "0.4rem", textAlign: "right" }}>Funds</th>
            </tr>
          </thead>
          <tbody>
            {data.by_fund_type.map((f) => (
              <tr key={f.kind} style={{ borderTop: "1px solid #e5e7eb" }}>
                <td style={{ padding: "0.4rem" }}>{f.name}</td>
                <td style={{ padding: "0.4rem", textAlign: "right" }}>{money(f.balance_cents, data!.base_currency)}</td>
                <td style={{ padding: "0.4rem", textAlign: "right" }}>{money(f.in_cents, data!.base_currency)}</td>
                <td style={{ padding: "0.4rem", textAlign: "right" }}>{money(f.out_cents, data!.base_currency)}</td>
                <td style={{ padding: "0.4rem", textAlign: "right" }}>{f.fund_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {data.closed_periods.length > 0 ? (
        <section aria-label="Closed periods" style={{ marginTop: "2.5rem" }}>
          <h2>Closed accounting periods</h2>
          <p style={{ color: "#6b7280" }}>
            Snapshots of the figures at close. These are frozen numbers used in our annual report.
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={{ padding: "0.4rem" }}>Period</th>
                <th style={{ padding: "0.4rem", textAlign: "right" }}>Gross received</th>
                <th style={{ padding: "0.4rem", textAlign: "right" }}>Net received</th>
                <th style={{ padding: "0.4rem", textAlign: "right" }}>Expenses</th>
                <th style={{ padding: "0.4rem" }}>Closed</th>
              </tr>
            </thead>
            <tbody>
              {data.closed_periods.map((p) => (
                <tr key={p.code} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "0.4rem" }}>{p.code}</td>
                  <td style={{ padding: "0.4rem", textAlign: "right" }}>{money(p.gross_cents, data!.base_currency)}</td>
                  <td style={{ padding: "0.4rem", textAlign: "right" }}>{money(p.net_cents, data!.base_currency)}</td>
                  <td style={{ padding: "0.4rem", textAlign: "right" }}>{money(p.expenses_cents, data!.base_currency)}</td>
                  <td style={{ padding: "0.4rem", color: "#6b7280" }}>{new Date(p.closed_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

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
          </Container>
        </Section>
      </main>
      <Footer />
    </>
  );
}

// Inline SVG stacked bar — avoids pulling a chart library onto a public
// page. Colors are brand-neutral and WCAG-safe when paired with the labels
// above the chart. The underlying numbers also appear in the table that
// follows, which is the authoritative read for screen-reader users.
function FundTypeChart({
  items,
  currency,
}: {
  items: Array<{ kind: string; name: string; balance_cents: number }>;
  currency: string;
}) {
  const total = items.reduce((n, x) => n + Math.max(0, x.balance_cents), 0);
  if (total === 0) return <p style={{ color: "#6b7280" }}>Fund balances are empty.</p>;
  const palette: Record<string, string> = {
    general: "#0ea5e9",
    project: "#f59e0b",
    restricted: "#8b5cf6",
    endowment: "#10b981",
  };
  let x = 0;
  const w = 100;
  return (
    <div>
      <svg
        viewBox="0 0 100 10"
        role="img"
        aria-label={`Balance by fund type: ${items.map((i) => `${i.name} ${((i.balance_cents / total) * 100).toFixed(0)}%`).join(", ")}`}
        style={{ width: "100%", height: "28px", borderRadius: "6px", background: "#f3f4f6" }}
      >
        {items.map((f) => {
          const pct = (Math.max(0, f.balance_cents) / total) * w;
          const seg = (
            <rect
              key={f.kind}
              x={x}
              y={0}
              width={pct}
              height={10}
              fill={palette[f.kind] ?? "#64748b"}
            >
              <title>{`${f.name}: ${(pct / w * 100).toFixed(1)}% (${currency} ${(f.balance_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })})`}</title>
            </rect>
          );
          x += pct;
          return seg;
        })}
      </svg>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "0.6rem 0 0",
          display: "flex",
          gap: "1rem",
          flexWrap: "wrap",
          fontSize: "0.85rem",
          color: "#374151",
        }}
      >
        {items.map((f) => (
          <li key={f.kind} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 2,
                background: palette[f.kind] ?? "#64748b",
              }}
            />
            {f.name}
          </li>
        ))}
      </ul>
    </div>
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
