"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/api";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

type Row = {
  _id: string;
  title: string;
  summary: string;
  state: string;
  version: number;
  reviewer_id: string | null;
  submitted_at: string | null;
  project_id: string;
  created_by: string;
};

const STATES = [
  "submitted",
  "in_review",
  "changes_requested",
  "approved",
  "published",
  "rejected",
];

export default function QueuePage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [state, setState] = useState<string>("submitted");

  const load = useCallback(async () => {
    setErr(null);
    try {
      const q = new URLSearchParams({ state, limit: "50" });
      const data = await api<{ items: Row[]; next_cursor: string | null }>(
        `/accomplishments?${q.toString()}`
      );
      setRows(data.items);
    } catch (e) {
      setErr((e as ApiClientError).message);
      setRows([]);
    }
  }, [state]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section>
      <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Review queue</h1>
      <div style={{ display: "flex", gap: "0.5rem", margin: "1rem 0", flexWrap: "wrap" }}>
        {STATES.map((s) => (
          <button
            key={s}
            onClick={() => setState(s)}
            aria-pressed={state === s}
            style={{
              padding: "0.4rem 0.9rem",
              borderRadius: 999,
              border: state === s ? "2px solid #111827" : "1px solid #e5e7eb",
              background: state === s ? "#111827" : "#fff",
              color: state === s ? "#fff" : "#111827",
              cursor: "pointer",
            }}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {err ? <ErrorState message={err} onRetry={() => void load()} /> : null}
      {rows === null ? <LoadingState /> : null}
      {rows && rows.length === 0 ? <EmptyState title="Nothing in this bucket" /> : null}
      {rows && rows.length > 0 ? (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.75rem" }}>
          {rows.map((r) => (
            <li
              key={r._id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: "1rem 1.25rem",
                background: "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "1rem",
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.05rem" }}>
                    <Link href={`/admin/queue/${r._id}`}>{r.title}</Link>
                  </h2>
                  <p style={{ margin: "0.3rem 0 0.5rem", color: "#374151" }}>{r.summary}</p>
                  <small style={{ color: "#6b7280" }}>
                    v{r.version}
                    {r.submitted_at
                      ? ` · submitted ${new Date(r.submitted_at).toLocaleString()}`
                      : null}
                  </small>
                </div>
                <StatusBadge status={r.state === "published" ? "active" : "pending"}>
                  {r.state}
                </StatusBadge>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
