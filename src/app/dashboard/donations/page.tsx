"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/api";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";

export const dynamic = "force-dynamic";

type Donation = {
  _id: string;
  public_id: string;
  gross_source_cents: number;
  source_currency: string;
  gross_base_cents: number;
  base_currency: string;
  received_at: string;
  status: string;
  recurring: boolean;
};

function money(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default function DonationsPage() {
  const [data, setData] = useState<{ items: Donation[]; unverified: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setData(await api<{ items: Donation[]; unverified: boolean }>("/me/donations"));
      } catch (e) {
        setErr((e as ApiClientError).message);
      }
    })();
  }, []);

  if (err) return <ErrorState message={err} />;
  if (!data) return <LoadingState />;

  if (data.unverified) {
    return (
      <section>
        <h1>Your donations</h1>
        <div style={{ background: "#fffbeb", border: "1px solid #f59e0b", padding: "1.25rem", borderRadius: 10 }}>
          <strong>Please confirm your email to see your donation history.</strong>
          <p>
            For your privacy, we only link donations to a verified email address. If you need a new
            verification link, request one from <Link href="/supporters/verify">the verification page</Link>.
          </p>
        </div>
      </section>
    );
  }

  if (data.items.length === 0) {
    return (
      <section>
        <h1>Your donations</h1>
        <EmptyState title="No donations yet" description="When you give, your acknowledgements will appear here." />
      </section>
    );
  }

  return (
    <section>
      <h1>Your donations</h1>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 10 }}>
        <thead>
          <tr style={{ textAlign: "left" }}>
            <th style={{ padding: "0.6rem" }}>Reference</th>
            <th style={{ padding: "0.6rem" }}>Date</th>
            <th style={{ padding: "0.6rem", textAlign: "right" }}>Amount</th>
            <th style={{ padding: "0.6rem" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((d) => (
            <tr key={d._id} style={{ borderTop: "1px solid #e5e7eb" }}>
              <td style={{ padding: "0.6rem", fontFamily: "monospace" }}>{d.public_id}</td>
              <td style={{ padding: "0.6rem" }}>{new Date(d.received_at).toLocaleDateString()}</td>
              <td style={{ padding: "0.6rem", textAlign: "right" }}>
                {money(d.gross_source_cents, d.source_currency)}
                {d.recurring ? <span style={{ color: "#6b7280" }}> · monthly</span> : null}
              </td>
              <td style={{ padding: "0.6rem" }}>{d.status.replace("_", " ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
