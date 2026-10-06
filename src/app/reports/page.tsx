import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { api } from "@/lib/api";
import { ReportsArchive } from "./ReportsArchive";

export const metadata: Metadata = {
  title: "Reports",
  description:
    "The quarterly and monthly impact reports Sarah's Foundation publishes — figures approved by finance, downloadable as tagged, accessible PDFs.",
};

export const revalidate = 600;

type Item = {
  id: string;
  period_kind: "month" | "quarter" | "year";
  period_code: string;
  title: string;
  published_at: string;
  content_hash: string | null;
  download_path: string;
};

export default async function ReportsPage() {
  let items: Item[] = [];
  try {
    const data = await api<{ items: Item[] }>("/public/reports", {
      tags: ["public:reports"],
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
        <ReportsArchive items={items} />
      </main>
      <Footer />
    </>
  );
}
