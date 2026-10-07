import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { api } from "@/lib/api";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PublicPageHero } from "@/components/layout/PublicPageHero";
import { Container, Section } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Accomplishments — Sarah's Foundation",
  description:
    "Field reports from Sarah's Foundation — short, dated write-ups of things that happened, where, and who they reached.",
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
    <>
      <Navbar />
      <main>
        <PublicPageHero
          eyebrow="Field reports"
          title="What happened, and where"
          description="Short write-ups from the people on the ground. Each entry names the project, the community, and — where we can — how many people it reached."
        />
        <Section>
          <Container>
            {items.length === 0 ? (
              <p
                style={{
                  textAlign: "center",
                  color: "#6b7280",
                  padding: "2rem 0",
                  fontStyle: "italic",
                }}
              >
                Nothing published yet. Check back soon.
              </p>
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
                      borderRadius: 14,
                      background: "#fff",
                      overflow: "hidden",
                      boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    {a.media[0] && a.media[0].kind === "photo" ? (
                      <div style={{ position: "relative", aspectRatio: "16/9", background: "#f1f5f9" }}>
                        <Image
                          src={a.media[0].url}
                          alt={a.media[0].alt ?? a.title}
                          fill
                          sizes="(max-width: 720px) 100vw, 360px"
                          style={{ objectFit: "cover" }}
                        />
                      </div>
                    ) : null}
                    <div
                      style={{
                        padding: "1rem 1.25rem 1.25rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.4rem",
                      }}
                    >
                      <h2 style={{ margin: 0, fontSize: "1.1rem", color: "#1e3a8a" }}>
                        <Link
                          href={`/accomplishments/${a.public_id}`}
                          style={{ color: "inherit", textDecoration: "none" }}
                        >
                          {a.title}
                        </Link>
                      </h2>
                      <small style={{ color: "#6b7280" }}>
                        <Link
                          href={`/projects/${a.project.slug}`}
                          style={{ color: "#1e40af" }}
                        >
                          {a.project.name}
                        </Link>{" "}
                        · {a.community.name} ·{" "}
                        {new Date(a.occurred_on).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </small>
                      <p style={{ margin: "0.25rem 0 0", color: "#374151" }}>{a.summary}</p>
                      {a.beneficiary_count ? (
                        <small
                          style={{
                            color: "#166534",
                            background: "#dcfce7",
                            padding: "2px 10px",
                            borderRadius: 999,
                            alignSelf: "flex-start",
                            fontWeight: 600,
                            marginTop: "0.3rem",
                          }}
                        >
                          {a.beneficiary_count} beneficiaries
                        </small>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Container>
        </Section>
      </main>
      <Footer />
    </>
  );
}
