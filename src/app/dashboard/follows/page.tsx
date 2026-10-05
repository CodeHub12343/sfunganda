"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";

export const dynamic = "force-dynamic";

type Row = { _id: string; project: { _id: string; slug: string; name: string } };

export default function FollowsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      setRows(await api<Row[]>("/me/follows"));
    } catch (e) {
      setErr((e as ApiClientError).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function unfollow(projectId: string) {
    try {
      await api(`/me/follows/${projectId}`, { method: "DELETE" });
      toast.show("Unfollowed", "ok");
      void load();
    } catch (e) {
      toast.show((e as ApiClientError).message, "error");
    }
  }

  if (err) return <ErrorState message={err} onRetry={load} />;
  if (rows === null) return <LoadingState />;

  return (
    <section>
      <h1>Following</h1>
      {rows.length === 0 ? (
        <EmptyState
          title="You aren't following anything yet"
          description="Browse projects and tap Follow to receive updates when they publish."
        />
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.5rem" }}>
          {rows.map((r) => (
            <li
              key={r._id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: "0.75rem 1rem",
              }}
            >
              <Link href={`/projects/${r.project.slug}`}>{r.project.name}</Link>
              <Button variant="ghost" onClick={() => unfollow(r.project._id)}>
                Unfollow
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
