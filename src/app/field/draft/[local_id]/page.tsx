"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/api";
import { Uploader } from "@/components/ui/Uploader";
import { deleteLocalDraft, getLocalDraft, saveLocalDraft, type LocalDraft } from "../../localDrafts";

export const dynamic = "force-dynamic";

export default function DraftPage({ params }: { params: Promise<{ local_id: string }> }) {
  const { local_id } = use(params);
  const router = useRouter();
  const [draft, setDraft] = useState<LocalDraft | null>(null);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    const d = getLocalDraft(local_id);
    if (!d) {
      router.replace("/field");
      return;
    }
    setDraft(d);
  }, [local_id, router]);

  if (!draft) return null;

  function update<K extends keyof LocalDraft>(key: K, value: LocalDraft[K]) {
    const next = { ...draft, [key]: value } as LocalDraft;
    setDraft(next);
    saveLocalDraft(next);
  }

  async function syncAndSubmit() {
    setStatus("Syncing…");
    try {
      let remote_id = draft?.remote_id;
      let version = draft?.version ?? 0;
      if (!draft) return;
      if (!remote_id) {
        const res = await api<{ id: string; version: number; state: string }>("/accomplishments", {
          json: {
            project_id: draft.project_id,
            milestone_id: draft.milestone_id,
            title: draft.title,
            summary: draft.summary,
            body_markdown: draft.body_markdown,
            occurred_on: draft.occurred_on,
            beneficiary_count: draft.beneficiary_count,
            location_label: draft.location_label,
            media_asset_ids: draft.media_asset_ids,
          },
        });
        remote_id = res.id;
        version = res.version;
      } else {
        const res = await api<{ id: string; version: number }>(`/accomplishments/${remote_id}`, {
          method: "PATCH",
          json: {
            title: draft.title,
            summary: draft.summary,
            body_markdown: draft.body_markdown,
            occurred_on: draft.occurred_on,
            beneficiary_count: draft.beneficiary_count,
            location_label: draft.location_label,
            media_asset_ids: draft.media_asset_ids,
            version,
          },
        });
        version = res.version;
      }
      setStatus("Submitting for review…");
      await api(`/accomplishments/${remote_id}/transition`, {
        json: { transition: "submit", version },
      });
      saveLocalDraft({ ...draft, remote_id, version: version + 1 });
      deleteLocalDraft(draft.local_id);
      setStatus("Submitted. Thank you!");
      setTimeout(() => router.push("/field"), 1200);
    } catch (e) {
      setStatus((e as ApiClientError).message);
    }
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <h2 style={{ margin: 0 }}>Edit draft</h2>

      <label>
        <span style={labelStyle}>Title</span>
        <input
          value={draft.title}
          onChange={(e) => update("title", e.target.value)}
          style={inputStyle}
        />
      </label>
      <label>
        <span style={labelStyle}>Summary</span>
        <input
          value={draft.summary}
          onChange={(e) => update("summary", e.target.value)}
          style={inputStyle}
        />
      </label>
      <label>
        <span style={labelStyle}>What happened</span>
        <textarea
          rows={6}
          value={draft.body_markdown}
          onChange={(e) => update("body_markdown", e.target.value)}
          style={inputStyle}
        />
      </label>

      <section>
        <h3>Photos</h3>
        <Uploader
          kind="photo"
          link={
            draft.remote_id
              ? { target: "accomplishment", id: draft.remote_id, role: "evidence" }
              : undefined
          }
          onUploaded={(assetId) =>
            update("media_asset_ids", [...(draft.media_asset_ids ?? []), assetId])
          }
        />
        <p style={{ color: "#6b7280", fontSize: "0.85rem" }}>
          {draft.media_asset_ids.length} photo(s) attached
        </p>
      </section>

      <section>
        <h3>Video</h3>
        <Uploader
          kind="video"
          viaProvider
          link={
            draft.remote_id
              ? { target: "accomplishment", id: draft.remote_id, role: "evidence" }
              : undefined
          }
          onUploaded={(assetId) =>
            update("media_asset_ids", [...(draft.media_asset_ids ?? []), assetId])
          }
        />
      </section>

      <button
        onClick={syncAndSubmit}
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
        Submit for review
      </button>
      <button
        type="button"
        onClick={() => {
          if (confirm("Delete this local draft? Uploaded media stays on the server.")) {
            deleteLocalDraft(draft.local_id);
            router.push("/field");
          }
        }}
        style={{ background: "transparent", border: 0, color: "#dc2626", cursor: "pointer" }}
      >
        Delete local draft
      </button>
      {status ? <p style={{ color: "#6b7280" }}>{status}</p> : null}
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", color: "#6b7280", fontSize: "0.85rem" };
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.65rem",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
};
