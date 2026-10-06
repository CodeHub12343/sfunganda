import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { api } from "@/lib/api";
import { BusinessList } from "./BusinessList";

export const metadata: Metadata = {
  title: "The businesses that fund the home",
  description:
    "Poultry, farming, crafts and small shops the foundation runs to feed and fund the children's home.",
};

export const revalidate = 600;

type Business = {
  slug: string;
  name: string;
  kind: string;
  summary: string;
  community: { slug: string; name: string; region_label: string } | null;
};

export default async function BusinessesPage() {
  let items: Business[] = [];
  try {
    const data = await api<{ items: Business[] }>("/public/businesses", {
      tags: ["public:businesses"],
      revalidate: 600,
    });
    items = data.items;
  } catch {
    items = [];
  }

  return (
    <>
      <Navbar />
      <main>
        <BusinessList items={items} />
      </main>
      <Footer />
    </>
  );
}
