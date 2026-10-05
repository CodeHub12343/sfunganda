import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { api } from "@/lib/api";

export const metadata: Metadata = {
  title: "Accomplishments — Sarah's Foundation",
  description: "Field reports from Sarah's Foundation.",
};

type Row = {
  public_id: string;
  title: string;
  summary: string;
  occurred_on: string;
  published_at: string;
  project: { slug: string; name: string };
  community: { slug: string; name: string; region_label: string };
  location_label: string | null;
  beneficiary_count: number | null;
  media: Array<{ id: string; url: string; kind: string; alt: string | null; width: number | null; height: number | null }>;
};

export default async function AccomplishmentsIndex() {
  let items: Row[] = [];
  try {
    const data = await api<{ items: Row[]; next_cursor: string | null }>(
      "/public/accomplishments",
      { tags: ["public:accomplishments"], revalidate: 120 }
    );
    items = data.items;
  } catch {
    items = [];
  }
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "3rem 1.25rem 5rem" }}>
      <h1 style={{ fontSize: "2.25rem", marginBottom: "2rem" }}>Accomplishments</h1>
      {items.length === 0 ? (
        <p>Nothing published yet. Check back soon.</p>
      ) : (
        <ol
          style={{
            listStyle: "none",
            padding: 0,
            display: "grid",
            gap: "1.5rem",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          }}
        >
          {items.map((a) => (
            <li
              key={a.public_id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                background: "#fff",
                overflow: "hidden",
              }}
            >
              {a.media[0] && a.media[0].kind === "photo" ? (
                <div style={{ position: "relative", aspectRatio: "16/9" }}>
                  <Image
                    src={a.media[0].url}
                    alt={a.media[0].alt ?? a.title}
                    fill
                    sizes="(max-width: 720px) 100vw, 320px"
                    style={{ objectFit: "cover" }}
                  />
                </div>
              ) : null}
              <div style={{ padding: "1rem 1.25rem" }}>
                <h2 style={{ margin: "0 0 0.3rem", fontSize: "1.1rem" }}>
                  <Link href={`/accomplishments/${a.public_id}`}>{a.title}</Link>
                </h2>
                <small style={{ color: "#6b7280" }}>
                  <Link href={`/projects/${a.project.slug}`}>{a.project.name}</Link> ·{" "}
                  {a.community.name} · {new Date(a.occurred_on).toLocaleDateString()}
                </small>
                <p style={{ marginTop: "0.5rem", color: "#374151" }}>{a.summary}</p>
                {a.beneficiary_count ? (
                  <small style={{ color: "#6b7280" }}>
                    {a.beneficiary_count} beneficiaries
                  </small>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
