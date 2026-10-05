"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { LoadingState, ErrorState } from "@/components/ui/States";

export const dynamic = "force-dynamic";

type Dashboard = {
  profile: { display_name: string; anonymous_on_wall: boolean } | null;
  follows: Array<{ _id: string; project: { _id: string; slug: string; name: string } }>;
  donations: { count: number; lifetime_cents: number; currency: string };
  unread_notifications: number;
};

function money(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default function DashboardOverview() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setData(await api<Dashboard>("/me/dashboard"));
      } catch (e) {
        setErr((e as ApiClientError).message);
      }
    })();
  }, []);

  if (err) return <ErrorState message={err} />;
  if (!data) return <LoadingState />;

  return (
    <section>
      <h1>Welcome back, {data.profile?.display_name ?? "friend"}.</h1>
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1rem",
          margin: "1.5rem 0",
        }}
      >
        <Tile label="Following" value={String(data.follows.length)} href="/dashboard/follows" />
        <Tile
          label="Donations"
          value={String(data.donations.count)}
          href="/dashboard/donations"
        />
        <Tile
          label="Lifetime giving"
          value={money(data.donations.lifetime_cents, data.donations.currency)}
          href="/dashboard/donations"
        />
        <Tile
          label="Unread updates"
          value={String(data.unread_notifications)}
          href="/dashboard/notifications"
        />
      </section>

      <h2>Projects you follow</h2>
      {data.follows.length === 0 ? (
        <p>
          You aren&apos;t following anything yet. Visit <Link href="/projects">Projects</Link> and
          pick one.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.5rem" }}>
          {data.follows.map((f) => (
            <li
              key={f._id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: "0.75rem 1rem",
                background: "#fff",
              }}
            >
              <Link href={`/projects/${f.project.slug}`}>{f.project.name}</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Tile({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "1rem 1.25rem",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        background: "#fff",
        textDecoration: "none",
        color: "#111827",
      }}
    >
      <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{value}</div>
      <small style={{ color: "#6b7280" }}>{label}</small>
    </Link>
  );
}
