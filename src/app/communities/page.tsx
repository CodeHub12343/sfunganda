import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { api } from "@/lib/api";
import { CommunitiesView } from "./CommunitiesView";

export const metadata: Metadata = {
  title: "Communities",
  description:
    "The communities Sarah's Foundation works in — coarse map locations and the active programmes in each.",
};

export const dynamic = "force-dynamic";

type CommunityItem = {
  slug: string;
  name: string;
  region_label: string;
  summary: string;
  active_projects: number;
};

type CommunityDetail = {
  slug: string;
  name: string;
  region_label: string;
  summary: string;
  public_lat: number | null;
  public_lng: number | null;
  businesses: Array<{ slug: string; name: string; kind: string; status: string }>;
};

export default async function CommunitiesPage() {
  let items: CommunityItem[] = [];
  let details: CommunityDetail[] = [];
  try {
    const list = await api<{ items: CommunityItem[] }>("/public/communities", {
      tags: ["public:communities"],
      revalidate: 600,
    });
    items = list.items;
    details = (await Promise.all(
      items.map((c) =>
        api<CommunityDetail>(`/public/communities/${c.slug}`, {
          tags: ["public:communities", `public:community:${c.slug}`],
          revalidate: 600,
        }).catch(() => null)
      )
    )).filter((x): x is CommunityDetail => x !== null);
  } catch {
    /* leave empty */
  }

  return (
    <>
      <Navbar />
      <main>
        <CommunitiesView items={items} details={details} />
      </main>
      <Footer />
    </>
  );
}
