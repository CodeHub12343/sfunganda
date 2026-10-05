"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { saveLocalDraft, newLocalId, type LocalDraft } from "../localDrafts";

export const dynamic = "force-dynamic";

type Project = { _id: string; name: string; slug: string };

export default function NewDraftPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    project_id: "",
    title: "",
    summary: "",
    body_markdown: "",
    occurred_on: new Date().toISOString().slice(0, 10),
    beneficiary_count: "",
    location_label: "",
  });

  useEffect(() => {
    void (async () => {
      try {
        const data = await api<{ items: Project[]; next_cursor: string | null }>("/projects?limit=100");
        setProjects(data.items);
        if (data.items[0]) setForm((f) => ({ ...f, project_id: data.items[0]!._id }));
      } catch (e) {
        setErr((e as ApiClientError).message);
      }
    })();
  }, []);

  function createAndEdit() {
    const draft: LocalDraft = {
      local_id: newLocalId(),
      project_id: form.project_id,
      title: form.title,
      summary: form.summary,
      body_markdown: form.body_markdown,
      occurred_on: form.occurred_on,
      beneficiary_count: form.beneficiary_count ? Number(form.beneficiary_count) : undefined,
      location_label: form.location_label || undefined,
      media_local: [],
      media_asset_ids: [],
      saved_at: new Date().toISOString(),
    };
    saveLocalDraft(draft);
    router.push(`/field/draft/${draft.local_id}`);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        createAndEdit();
      }}
      style={{ display: "grid", gap: "0.9rem" }}
    >
      {err ? <p style={{ color: "#dc2626" }}>{err}</p> : null}
      <label>
        <span style={{ display: "block", color: "#6b7280", fontSize: "0.85rem" }}>Project</span>
        <select
          required
          value={form.project_id}
          onChange={(e) => setForm({ ...form, project_id: e.target.value })}
          style={inputStyle}
        >
          {projects.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span style={labelStyle}>Title</span>
        <input
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          style={inputStyle}
        />
      </label>
      <label>
        <span style={labelStyle}>Summary (1-2 sentences)</span>
        <input
          required
          value={form.summary}
          onChange={(e) => setForm({ ...form, summary: e.target.value })}
          style={inputStyle}
        />
      </label>
      <label>
        <span style={labelStyle}>What happened</span>
        <textarea
          required
          rows={6}
          value={form.body_markdown}
          onChange={(e) => setForm({ ...form, body_markdown: e.target.value })}
          style={inputStyle}
        />
      </label>
      <label>
        <span style={labelStyle}>Occurred on</span>
        <input
          type="date"
          required
          value={form.occurred_on}
          onChange={(e) => setForm({ ...form, occurred_on: e.target.value })}
          style={inputStyle}
        />
      </label>
      <label>
        <span style={labelStyle}>Beneficiaries (optional)</span>
        <input
          type="number"
          min={0}
          value={form.beneficiary_count}
          onChange={(e) => setForm({ ...form, beneficiary_count: e.target.value })}
          style={inputStyle}
        />
      </label>
      <label>
        <span style={labelStyle}>Location label (coarse — village, cluster)</span>
        <input
          value={form.location_label}
          onChange={(e) => setForm({ ...form, location_label: e.target.value })}
          style={inputStyle}
        />
      </label>
      <button
        type="submit"
        style={{
          padding: "1rem",
          background: "#111827",
          color: "#fff",
          border: 0,
          borderRadius: 10,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Save and add media
      </button>
    </form>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  color: "#6b7280",
  fontSize: "0.85rem",
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.65rem",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
};
