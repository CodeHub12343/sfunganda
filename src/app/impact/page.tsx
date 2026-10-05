import type { Metadata } from "next";
import { api } from "@/lib/api";

export const metadata: Metadata = {
  title: "Impact — Sarah's Foundation",
  description: "Totals and metrics across our work.",
};

type Impact = {
  totals: { projects: number; communities: number; accomplishments: number };
  metrics: Array<{ key: string; label: string; unit: string; value: number }>;
};

export default async function ImpactPage() {
  let data: Impact = {
    totals: { projects: 0, communities: 0, accomplishments: 0 },
    metrics: [],
  };
  try {
    data = await api<Impact>("/public/impact", {
      tags: ["public:impact", "public:home"],
      revalidate: 300,
    });
  } catch {
    // leave zeros
  }
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "3rem 1.25rem 5rem" }}>
      <h1 style={{ fontSize: "2.25rem", marginBottom: "2rem" }}>Impact</h1>
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <Tile label="Projects" value={data.totals.projects} />
        <Tile label="Communities" value={data.totals.communities} />
        <Tile label="Accomplishments" value={data.totals.accomplishments} />
      </section>
      {data.metrics.length > 0 ? (
        <section>
          <h2>Measured outcomes</h2>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "1rem",
            }}
          >
            {data.metrics.map((m) => (
              <li
                key={m.key}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: "1rem 1.25rem",
                  background: "#fff",
                }}
              >
                <strong style={{ fontSize: "1.6rem" }}>
                  {Intl.NumberFormat().format(m.value)}
                </strong>
                <div style={{ color: "#6b7280" }}>
                  {m.label} ({m.unit})
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: "1.25rem",
        background: "#fff",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "2rem", fontWeight: 700 }}>
        {Intl.NumberFormat().format(value)}
      </div>
      <div style={{ color: "#6b7280" }}>{label}</div>
    </div>
  );
}
