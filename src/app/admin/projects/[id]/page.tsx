"use client";

import { useCallback, useEffect, useState } from "react";
import { use } from "react";
import { api, ApiClientError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { ErrorState, LoadingState } from "@/components/ui/States";

export const dynamic = "force-dynamic";

type Project = {
  _id: string;
  name: string;
  slug: string;
  summary: string;
  description: string;
  status: string;
  progress_pct: number;
  milestone_counts: { total: number; complete: number; in_progress: number };
  community_id: string;
  version: number;
};

type Milestone = {
  _id: string;
  title: string;
  description: string;
  status: "planned" | "in_progress" | "complete" | "cancelled";
  due_on: string | null;
  weight: number;
  order: number;
  version: number;
};

export default function AdminProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [newMilestone, setNewMilestone] = useState({ title: "", weight: 1, due_on: "" });

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [p, m] = await Promise.all([
        api<Project>(`/projects/${id}`),
        api<Milestone[]>(`/projects/${id}/milestones`),
      ]);
      setProject(p);
      setMilestones(m);
    } catch (e) {
      setErr((e as ApiClientError).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateMilestone(m: Milestone, patch: Partial<Milestone>) {
    try {
      await api(`/projects/milestones/${m._id}`, {
        method: "PATCH",
        json: { ...patch, version: m.version },
      });
      toast.show("Saved", "ok");
      void load();
    } catch (e) {
      toast.show((e as ApiClientError).message, "error");
    }
  }

  async function addMilestone() {
    if (!project) return;
    try {
      await api("/projects/milestones", {
        json: {
          project_id: project._id,
          title: newMilestone.title,
          weight: newMilestone.weight,
          due_on: newMilestone.due_on || undefined,
        },
      });
      toast.show("Milestone added", "ok");
      setNewMilestone({ title: "", weight: 1, due_on: "" });
      void load();
    } catch (e) {
      toast.show((e as ApiClientError).message, "error");
    }
  }

  async function updateProjectField(patch: Partial<Project>) {
    if (!project) return;
    try {
      await api(`/projects/${project._id}`, {
        method: "PATCH",
        json: { ...patch, version: project.version },
      });
      toast.show("Saved", "ok");
      void load();
    } catch (e) {
      toast.show((e as ApiClientError).message, "error");
    }
  }

  if (!project && !err) return <LoadingState />;
  if (err) return <ErrorState message={err} onRetry={() => void load()} />;
  if (!project) return null;

  return (
    <section style={{ display: "grid", gap: "1.5rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0 }}>{project.name}</h1>
          <small style={{ color: "#6b7280" }}>
            {project.slug} · v{project.version}
          </small>
        </div>
        <StatusBadge status={project.status === "active" ? "active" : "pending"}>
          {project.status}
        </StatusBadge>
      </header>

      <section style={card}>
        <h2 style={{ marginTop: 0 }}>Summary</h2>
        <textarea
          value={project.summary}
          onChange={(e) => setProject({ ...project, summary: e.target.value })}
          rows={3}
          style={input}
        />
        <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem" }}>
          <Button onClick={() => updateProjectField({ summary: project.summary })}>Save summary</Button>
          <select
            value={project.status}
            onChange={(e) => updateProjectField({ status: e.target.value })}
            style={input}
          >
            {["planning", "active", "paused", "completed", "archived"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section style={card}>
        <h2 style={{ marginTop: 0 }}>
          Milestones ({project.milestone_counts.complete}/{project.milestone_counts.total} ·{" "}
          {project.progress_pct}%)
        </h2>
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.6rem" }}>
          {milestones.map((m) => (
            <li
              key={m._id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: "0.75rem 1rem",
                display: "flex",
                gap: "0.5rem",
                alignItems: "center",
              }}
            >
              <strong style={{ flex: 1 }}>{m.title}</strong>
              <select
                value={m.status}
                onChange={(e) =>
                  updateMilestone(m, { status: e.target.value as Milestone["status"] })
                }
                style={input}
              >
                {["planned", "in_progress", "complete", "cancelled"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <small style={{ color: "#6b7280" }}>w{m.weight}</small>
            </li>
          ))}
        </ul>

        <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "2fr 1fr 1fr auto", marginTop: "1rem" }}>
          <input
            placeholder="New milestone title"
            value={newMilestone.title}
            onChange={(e) => setNewMilestone({ ...newMilestone, title: e.target.value })}
            style={input}
          />
          <input
            type="number"
            min={1}
            max={100}
            value={newMilestone.weight}
            onChange={(e) => setNewMilestone({ ...newMilestone, weight: Number(e.target.value) })}
            style={input}
          />
          <input
            type="date"
            value={newMilestone.due_on}
            onChange={(e) => setNewMilestone({ ...newMilestone, due_on: e.target.value })}
            style={input}
          />
          <Button onClick={addMilestone} disabled={!newMilestone.title}>
            Add
          </Button>
        </div>
      </section>
    </section>
  );
}

const card: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: "1rem 1.25rem",
  background: "#fff",
};
const input: React.CSSProperties = {
  padding: "0.5rem",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  width: "100%",
};
