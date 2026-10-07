import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api, ApiClientError } from "@/lib/api";
import { FundingBlock } from "@/components/ui/FundingBlock";
import { FollowButton } from "@/components/ui/FollowButton";

type Project = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  status: string;
  progress_pct: number;
  milestone_counts: { total: number; complete: number; in_progress: number };
  category: { name: string; color: string | null } | null;
  community: { slug: string; name: string; region_label: string };
  milestones: Array<{ title: string; status: string; due_on: string | null }>;
  recent_accomplishments: Array<{ public_id: string; title: string; published_at: string }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const p = await api<Project>(`/public/projects/${slug}`, {
      tags: ["public:projects", `public:project:${slug}`],
      revalidate: 300,
    });
    return { title: `${p.name} — Sarah's Foundation`, description: p.summary };
  } catch {
    return { title: "Project — Sarah's Foundation" };
  }
}

export default async function ProjectDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let project: Project;
  try {
    project = await api<Project>(`/public/projects/${slug}`, {
      tags: ["public:projects", `public:project:${slug}`],
      revalidate: 300,
    });
  } catch (err) {
    if (err instanceof ApiClientError && err.code === "not_found") notFound();
    throw err;
  }

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "3rem 1.25rem 5rem" }}>
      <nav aria-label="Breadcrumb" style={{ marginBottom: "1rem", color: "#6b7280" }}>
        <Link href="/projects">Projects</Link> → <strong>{project.name}</strong>
      </nav>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "2.25rem", marginBottom: "0.4rem" }}>{project.name}</h1>
          <p style={{ color: "#6b7280", margin: 0 }}>
            {project.community.name} · {project.community.region_label}
            {project.category ? ` · ${project.category.name}` : null}
          </p>
        </div>
        <FollowButton projectId={project.id} />
      </div>

      <section aria-label="Progress" style={{ margin: "1.5rem 0" }}>
        <h2 style={{ fontSize: "1rem", margin: "0 0 0.4rem" }}>Progress</h2>
        <div
          role="progressbar"
          aria-valuenow={project.progress_pct}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{ background: "#e5e7eb", borderRadius: 999, height: 10, overflow: "hidden" }}
        >
          <div
            style={{
              width: `${project.progress_pct}%`,
              height: "100%",
              background: "linear-gradient(90deg, #f59e0b, #ef4444)",
            }}
          />
        </div>
        <small style={{ color: "#6b7280" }}>
          {project.progress_pct}% · {project.milestone_counts.complete} / {project.milestone_counts.total} milestones complete
        </small>
      </section>

      <p style={{ fontSize: "1.1rem" }}>{project.summary}</p>
      {project.description ? <p>{project.description}</p> : null}

      <FundingBlock projectSlug={project.slug} />

      <section aria-label="Milestones" style={{ marginTop: "2rem" }}>
        <h2>Milestones</h2>
        {project.milestones.length === 0 ? (
          <p style={{ color: "#6b7280" }}>No milestones published yet.</p>
        ) : (
          <ol style={{ paddingLeft: "1.25rem" }}>
            {project.milestones.map((m, i) => (
              <li key={i} style={{ margin: "0.6rem 0" }}>
                <strong>{m.title}</strong>{" "}
                <span style={{ color: "#6b7280" }}>({m.status.replace("_", " ")})</span>
                {m.due_on ? (
                  <small style={{ color: "#6b7280" }}>
                    {" "}
                    · due {new Date(m.due_on).toLocaleDateString()}
                  </small>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-label="Recent accomplishments" style={{ marginTop: "2rem" }}>
        <h2>Recent accomplishments</h2>
        {project.recent_accomplishments.length === 0 ? (
          <p style={{ color: "#6b7280" }}>Nothing published yet.</p>
        ) : (
          <ul style={{ paddingLeft: "1.25rem" }}>
            {project.recent_accomplishments.map((a) => (
              <li key={a.public_id}>
                <Link href={`/accomplishments/${a.public_id}`}>{a.title}</Link>{" "}
                <small style={{ color: "#6b7280" }}>
                  {new Date(a.published_at).toLocaleDateString()}
                </small>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
