import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { api } from "@/lib/api";
import { Gallery, type GalleryPhoto } from "./Gallery";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Before &amp; after",
  description:
    "Progress from day one to today — site photographs you can drag across to compare, framed by what changed and what we're still working on.",
};

// Phase 8: these are programme-level before/after images. We never show
// identifiable children in the "after" frame — the safeguarding policy is
// enforced by the media review workflow (Phase 2). Captions describe the
// change, not the people in it.
const PANELS: Array<{
  title: string;
  caption: string;
  before: { src: string; alt: string };
  after: { src: string; alt: string };
}> = [
  {
    title: "Garden plot, 2024 → 2026",
    caption:
      "The vegetable plot we planted in 2024 now feeds the household and sells surplus at the local market — one of three food-sustainability projects.",
    before: {
      src: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1400&q=80",
      alt: "An empty plot of land before planting, grass and bare earth.",
    },
    after: {
      src: "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1400&q=80",
      alt: "The same plot of land, now a productive vegetable garden with rows of leafy crops.",
    },
  },
  {
    title: "Poultry shed, 2025 → 2026",
    caption:
      "The poultry shed produces eggs for daily meals and small-scale sales — a steady recurring revenue line on the sustainability page.",
    before: {
      src: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1400&q=80",
      alt: "The future shed site, a cleared patch of ground.",
    },
    after: {
      src: "https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?auto=format&fit=crop&w=1400&q=80",
      alt: "A completed timber poultry shed with roof and feed troughs.",
    },
  },
];

export default async function GalleryPage() {
  let photos: GalleryPhoto[] = [];
  try {
    photos = await api<GalleryPhoto[]>("/photos");
  } catch {
    photos = [];
  }
  return (
    <>
      <Navbar />
      <main>
        <Gallery panels={PANELS} photos={photos} />
      </main>
      <Footer />
    </>
  );
}
