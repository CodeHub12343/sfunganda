import type { Metadata } from "next";
import Link from "next/link";
import { api } from "@/lib/api";

export const metadata: Metadata = {
  title: "Communities — Sarah's Foundation",
};

type Row = { slug: string; name: string; region_label: string; summary: string; active_projects: number };

export default async function CommunitiesIndex() {
  let items: Row[] = [];
  try {
    const data = await api<{ items: Row[] }>("/public/communities", {
      tags: ["public:communities"],
      revalidate: 600,
    });
    items = data.items;
  } catch {
    items = [];
  }
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "3rem 1.25rem 5rem" }}>
      <h1 style={{ fontSize: "2.25rem", marginBottom: "2rem" }}>Communities</h1>
      {items.length === 0 ? (
        <p>No community profiles published yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "1rem" }}>
          {items.map((c) => (
            <li
              key={c.slug}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: "1rem 1.25rem",
                background: "#fff",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "1.2rem" }}>
                <Link href={`/accomplishments?community=${c.slug}`}>{c.name}</Link>
              </h2>
              <small style={{ color: "#6b7280" }}>{c.region_label}</small>
              <p style={{ margin: "0.5rem 0 0", color: "#374151" }}>{c.summary}</p>
              <small style={{ color: "#6b7280" }}>{c.active_projects} active projects</small>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
