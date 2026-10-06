import type { Metadata } from "next";
import { api } from "@/lib/api";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PublicPageHero } from "@/components/layout/PublicPageHero";
import { Container, Section } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Impact — Sarah's Foundation",
  description:
    "Totals and measured outcomes across every community and project we work with.",
};

export const dynamic = "force-dynamic";

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
    <>
      <Navbar />
      <main>
        <PublicPageHero
          eyebrow="Our impact"
          title="What our work adds up to"
          description="The numbers below are rolled up from the project pages and field reports — nothing on this page is pulled from a glossy brochure."
        />
        <Section>
          <Container>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "1rem",
                marginBottom: "3rem",
              }}
            >
              <Tile label="Projects" value={data.totals.projects} />
              <Tile label="Communities" value={data.totals.communities} />
              <Tile label="Accomplishments" value={data.totals.accomplishments} />
            </div>
            {data.metrics.length > 0 ? (
              <section>
                <h2
                  style={{
                    fontSize: "1.5rem",
                    margin: "0 0 1rem",
                    color: "#1e3a8a",
                  }}
                >
                  Measured outcomes
                </h2>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: "1rem",
                  }}
                >
                  {data.metrics.map((m) => (
                    <li
                      key={m.key}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: "1.25rem 1.5rem",
                        background: "#fff",
                        boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
                      }}
                    >
                      <strong style={{ fontSize: "1.75rem", color: "#1e3a8a" }}>
                        {Intl.NumberFormat().format(m.value)}
                      </strong>
                      <div style={{ color: "#6b7280", marginTop: "0.25rem" }}>
                        {m.label}{" "}
                        <span style={{ color: "#9ca3af" }}>({m.unit})</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </Container>
        </Section>
      </main>
      <Footer />
    </>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: "1.6rem 1.25rem",
        background: "#fff",
        textAlign: "center",
        boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
      }}
    >
      <div style={{ fontSize: "2.4rem", fontWeight: 800, color: "#1e3a8a" }}>
        {Intl.NumberFormat().format(value)}
      </div>
      <div
        style={{
          color: "#6b7280",
          marginTop: "0.3rem",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontSize: "0.78rem",
          fontWeight: 600,
        }}
      >
        {label}
      </div>
    </div>
  );
}
