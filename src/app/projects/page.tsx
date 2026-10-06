import type { Metadata } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PublicPageHero } from "@/components/layout/PublicPageHero";
import { Container, Section } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Projects — Sarah's Foundation",
  description:
    "Every active project at Sarah's Foundation — what's happening, where, and how far along it is.",
};

export const dynamic = "force-dynamic";

type Row = {
  slug: string;
  name: string;
  summary: string;
  status: string;
  progress_pct: number;
  milestone_counts: { total: number; complete: number; in_progress: number };
  category: { name: string; color: string | null } | null;
  community: { slug: string; name: string; region_label: string };
};

export default async function ProjectsIndex() {
  let items: Row[] = [];
  try {
    const data = await api<{ items: Row[] }>("/public/projects", {
      tags: ["public:projects"],
      revalidate: 300,
    });
    items = data.items;
  } catch {
    items = [];
  }
  return (
    <>
      <Navbar />
      <main>
        <PublicPageHero
          eyebrow="Programmes"
          title="Projects we're running right now"
          description="Each card is a live project — the progress bar tracks completed milestones against the plan, not promises."
        />
        <Section>
          <Container>
            {items.length === 0 ? (
              <p style={{ textAlign: "center", color: "#6b7280", padding: "2rem 0", fontStyle: "italic" }}>
                No projects to show yet.
              </p>
            ) : (
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  display: "grid",
                  gap: "1.25rem",
                  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                }}
              >
                {items.map((p) => (
                  <li
                    key={p.slug}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 14,
                      padding: "1.25rem 1.4rem",
                      background: "#fff",
                      boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.6rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "0.75rem",
                        alignItems: "baseline",
                      }}
                    >
                      <h2 style={{ margin: 0, fontSize: "1.15rem", color: "#1e3a8a" }}>
                        <Link
                          href={`/projects/${p.slug}`}
                          style={{ color: "inherit", textDecoration: "none" }}
                        >
                          {p.name}
                        </Link>
                      </h2>
                      <StatusBadge status={p.status} />
                    </div>
                    <small style={{ color: "#6b7280" }}>
                      {p.community.name} · {p.community.region_label}
                    </small>
                    <p style={{ margin: 0, color: "#374151" }}>{p.summary}</p>
                    <ProgressBar value={p.progress_pct} />
                    <small style={{ color: "#6b7280" }}>
                      {p.milestone_counts.complete} / {p.milestone_counts.total} milestones complete
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </Container>
        </Section>
      </main>
      <Footer />
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    active: { bg: "#dcfce7", fg: "#166534" },
    planning: { bg: "#fef3c7", fg: "#92400e" },
    paused: { bg: "#f3f4f6", fg: "#374151" },
    complete: { bg: "#dbeafe", fg: "#1e40af" },
  };
  const c = colors[status] ?? { bg: "#f3f4f6", fg: "#374151" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
        fontSize: "0.72rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {status}
    </span>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Project progress"
      style={{
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
