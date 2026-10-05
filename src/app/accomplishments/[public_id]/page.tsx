import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api, ApiClientError } from "@/lib/api";

type Doc = {
  public_id: string;
  title: string;
  summary: string;
  body_markdown: string;
  occurred_on: string;
  published_at: string;
  project: { slug: string; name: string };
  community: { slug: string; name: string; region_label: string };
  location_label: string | null;
  beneficiary_count: number | null;
  media: Array<{ id: string; url: string; kind: string; alt: string | null; width: number | null; height: number | null }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ public_id: string }>;
}): Promise<Metadata> {
  const { public_id } = await params;
  try {
    const d = await api<Doc>(`/public/accomplishments/${public_id}`, {
      tags: ["public:accomplishments", `public:accomplishment:${public_id}`],
      revalidate: 300,
    });
    return { title: `${d.title} — Sarah's Foundation`, description: d.summary };
  } catch {
    return { title: "Accomplishment — Sarah's Foundation" };
  }
}

export default async function AccomplishmentDetail({
  params,
}: {
  params: Promise<{ public_id: string }>;
}) {
  const { public_id } = await params;
  let doc: Doc;
  try {
    doc = await api<Doc>(`/public/accomplishments/${public_id}`, {
      tags: ["public:accomplishments", `public:accomplishment:${public_id}`],
      revalidate: 300,
    });
  } catch (err) {
    if (err instanceof ApiClientError && err.code === "not_found") notFound();
    throw err;
  }
  const hero = doc.media.find((m) => m.kind === "photo");
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "3rem 1.25rem 5rem" }}>
      <nav aria-label="Breadcrumb" style={{ marginBottom: "1rem", color: "#6b7280" }}>
        <Link href="/accomplishments">Accomplishments</Link>
      </nav>
      <h1 style={{ fontSize: "2rem", margin: "0 0 0.4rem" }}>{doc.title}</h1>
      <p style={{ color: "#6b7280" }}>
        <Link href={`/projects/${doc.project.slug}`}>{doc.project.name}</Link> ·{" "}
        {doc.community.name} · {new Date(doc.occurred_on).toLocaleDateString()}
        {doc.location_label ? ` · ${doc.location_label}` : null}
      </p>
      {hero ? (
        <div
          style={{
            position: "relative",
            aspectRatio: "16/9",
            margin: "1.25rem 0",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <Image
            src={hero.url}
            alt={hero.alt ?? doc.title}
            fill
            sizes="(max-width: 760px) 100vw, 760px"
            style={{ objectFit: "cover" }}
          />
        </div>
      ) : null}
      <p style={{ fontSize: "1.1rem", fontWeight: 500 }}>{doc.summary}</p>
      <article
        style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(doc.body_markdown) }}
      />
      {doc.beneficiary_count ? (
        <p style={{ marginTop: "2rem", color: "#6b7280" }}>
          <strong>{doc.beneficiary_count}</strong> people impacted
        </p>
      ) : null}
      <small style={{ color: "#6b7280", display: "block", marginTop: "2rem" }}>
        Published {new Date(doc.published_at).toLocaleString()} · reference {doc.public_id}
      </small>
    </main>
  );
}

// Minimal, safe markdown — only escapes HTML and converts newlines. Keeps us
// out of the hairy "render untrusted content" territory until we ship a
// full sanitizer (Phase 4 adds a hardened pipeline).
function renderMarkdown(src: string): string {
  const esc = src.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
  );
  return esc
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
}
