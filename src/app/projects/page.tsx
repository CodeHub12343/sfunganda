import type { Metadata } from "next";
import Link from "next/link";
import { api } from "@/lib/api";

export const metadata: Metadata = {
  title: "Projects — Sarah's Foundation",
  description: "Active projects by Sarah's Foundation.",
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
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "3rem 1.25rem 5rem" }}>
      <h1 style={{ fontSize: "2.25rem", marginBottom: "2rem" }}>Projects</h1>
      {items.length === 0 ? (
        <p>No projects to show yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "1rem" }}>
          {items.map((p) => (
            <li
              key={p.slug}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: "1rem 1.25rem",
                background: "#fff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <h2 style={{ margin: 0, fontSize: "1.2rem" }}>
                  <Link href={`/projects/${p.slug}`}>{p.name}</Link>
                </h2>
                <small style={{ color: "#6b7280" }}>
                  {p.community.name} · {p.community.region_label}
                </small>
              </div>
              <p style={{ margin: "0.4rem 0 0.75rem", color: "#374151" }}>{p.summary}</p>
              <ProgressBar value={p.progress_pct} />
              <small style={{ color: "#6b7280" }}>
                {p.milestone_counts.complete} / {p.milestone_counts.total} milestones complete · {p.status}
              </small>
            </li>
          ))}
        </ul>
      )}
    </main>
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
        margin: "0.5rem 0",
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
