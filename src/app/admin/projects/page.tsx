"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";

export const dynamic = "force-dynamic";

type Project = {
  _id: string;
  name: string;
  slug: string;
  status: string;
  progress_pct: number;
  milestone_counts: { total: number; complete: number };
  community_id: string;
  version: number;
};

type Community = { _id: string; name: string; slug: string };

export default function AdminProjects() {
  const toast = useToast();
  const [rows, setRows] = useState<Project[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    community_id: "",
    summary: "",
  });

  const load = useCallback(async () => {
    setErr(null);
    try {
      const data = await api<{ items: Project[]; next_cursor: string | null }>("/projects?limit=100");
      setRows(data.items);
    } catch (e) {
      setErr((e as ApiClientError).message);
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
    void api<Community[]>("/projects/communities")
      .then((d) => setCommunities(d))
      .catch(() => setCommunities([]));
  }, [load]);

  async function create() {
    try {
      await api("/projects", {
        json: {
          name: form.name,
          slug: form.slug,
          community_id: form.community_id,
          summary: form.summary,
          status: "planning",
        },
      });
      toast.show("Project created", "ok");
      setForm({ name: "", slug: "", community_id: form.community_id, summary: "" });
      void load();
    } catch (e) {
      toast.show((e as ApiClientError).message, "error");
    }
  }

  return (
    <section>
      <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Projects</h1>

      <section
        style={{
          marginTop: "1.5rem",
          padding: "1rem 1.25rem",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          background: "#fff",
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: "1rem" }}>New project</h2>
        <div style={{ display: "grid", gap: "0.6rem", gridTemplateColumns: "1fr 1fr" }}>
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            style={input}
          />
          <input
            placeholder="slug"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            style={input}
          />
          <select
            value={form.community_id}
            onChange={(e) => setForm({ ...form, community_id: e.target.value })}
            style={input}
          >
            <option value="">Pick a community…</option>
            {communities.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Summary"
            value={form.summary}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
            style={input}
          />
        </div>
        <div style={{ marginTop: "0.75rem" }}>
          <Button
            variant="primary"
            onClick={create}
            disabled={!form.name || !form.slug || !form.community_id || !form.summary}
          >
            Create
          </Button>
        </div>
      </section>

      {err ? <ErrorState message={err} onRetry={() => void load()} /> : null}
      {rows === null ? <LoadingState /> : null}
      {rows && rows.length === 0 ? <EmptyState title="No projects yet" /> : null}
      {rows && rows.length > 0 ? (
        <ul style={{ listStyle: "none", padding: 0, marginTop: "1.5rem", display: "grid", gap: "0.75rem" }}>
          {rows.map((p) => (
            <li
              key={p._id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: "1rem 1.25rem",
                background: "#fff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.05rem" }}>
                    <Link href={`/admin/projects/${p._id}`}>{p.name}</Link>
                  </h2>
                  <small style={{ color: "#6b7280" }}>
                    {p.slug} · {p.milestone_counts.complete}/{p.milestone_counts.total} milestones ·{" "}
                    {p.progress_pct}% complete
                  </small>
                </div>
                <StatusBadge status={p.status === "active" ? "active" : "pending"}>{p.status}</StatusBadge>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

const input: React.CSSProperties = {
  padding: "0.55rem 0.7rem",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
};
