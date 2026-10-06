import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { api } from "@/lib/api";
import { SustainabilityPanel } from "./SustainabilityPanel";

export const metadata: Metadata = {
  title: "Sustainability",
  description:
    "How much of our operating costs are covered by the businesses we run — straight from the ledger, month by month.",
};

export const dynamic = "force-dynamic";

type MonthRow = {
  month: string;
  revenue_base_cents: number;
  operating_expense_base_cents: number;
  ratio: number;
  revenue_rows: Array<{
    seq: number;
    posted_at: string;
    amount_cents: number;
    account: string;
    business_id: string | null;
    transaction_public_id: string | null;
  }>;
  expense_rows: Array<{
    seq: number;
    posted_at: string;
    amount_cents: number;
    account: string;
    expense_category_id: string | null;
    transaction_public_id: string | null;
  }>;
};

type Payload = {
  community: { slug: string; name: string } | null;
  months: MonthRow[];
};

export default async function SustainabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ community?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.community ? `?community=${encodeURIComponent(sp.community)}` : "";
  let data: Payload;
  try {
    data = await api<Payload>(`/public/sustainability${q}`, {
      tags: ["public:sustainability"],
      revalidate: 600,
    });
  } catch {
    data = { community: null, months: [] };
  }

  return (
    <>
      <Navbar />
      <main>
        <SustainabilityPanel data={data} />
      </main>
      <Footer />
    </>
  );
}
