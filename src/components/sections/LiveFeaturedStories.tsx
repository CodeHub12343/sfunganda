import { FeaturedStories } from "./FeaturedStories";
import type { ProgrammeStory } from "@/data/content";

// =============================================================================
// Server wrapper that replaces the invented programme cards with the three
// most-recent approved, published accomplishments. All safeguarding rules
// (§15, §19.3) have been met for anything in /public/accomplishments:
// director-approved, no beneficiary photos, no full names, non-identifying
// imagery.
//
// If the API is unreachable, we fall through to the programme-level
// fallback copy — the page still renders.
// =============================================================================

type PublicAccomplishment = {
  public_id: string;
  title: string;
  summary: string;
  project_slug: string;
  project_name: string;
  community_slug: string;
  community_name: string;
  published_at: string;
};

const TONES: ProgrammeStory["tone"][] = ["gold", "green", "blue"];

async function fetchRecent(): Promise<PublicAccomplishment[]> {
  const origin = process.env.API_ORIGIN;
  if (!origin) return [];
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 2000);
  try {
    const r = await fetch(`${origin}/v1/public/accomplishments?limit=3`, {
      signal: ctl.signal,
      headers: process.env.INTERNAL_PROXY_SECRET
        ? { "x-internal-secret": process.env.INTERNAL_PROXY_SECRET }
        : undefined,
      next: { revalidate: 300, tags: ["public:accomplishments"] },
    });
    if (!r.ok) return [];
    const j = (await r.json()) as { data?: { items?: PublicAccomplishment[] } };
    return j.data?.items ?? [];
  } catch {
    return [];
  } finally {
    clearTimeout(to);
  }
}

export async function LiveFeaturedStories() {
  const rows = await fetchRecent();
  if (rows.length === 0) return <FeaturedStories />;

  const stories: ProgrammeStory[] = rows.map((a, i) => ({
    id: a.public_id,
    title: a.title,
    summary: a.summary,
    body: `${a.project_name} — ${a.community_name}. Published ${new Date(a.published_at).toLocaleDateString()}.`,
    tag: a.project_name,
    tone: TONES[i % TONES.length]!,
  }));
  return <FeaturedStories stories={stories} />;
}
