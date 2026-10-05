"use client";

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { Button } from "@/components/ui/Button";
import { Uploader } from "@/components/ui/Uploader";
import { useToast } from "@/components/ui/Toast";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api, ApiClientError } from "@/lib/api";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  kind: "photo" | "document" | "video";
  status:
    | "ticketed"
    | "uploading"
    | "pending_scan"
    | "pending_processing"
    | "ready"
    | "rejected"
    | "deleted";
  visibility: "internal" | "public";
  bytes: number;
  mime: string;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  exif_stripped: boolean;
  alt_text: string | null;
  caption: string | null;
  flags: { reason: string; at: string }[];
  original_filename: string;
  created_at: string;
  provider_ready: boolean;
};

const Header = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 1.5rem;
  h1 {
    font-family: ${({ theme }) => theme.font.heading};
    font-size: 1.5rem;
    margin: 0;
  }
`;

const Filters = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  select,
  input {
    padding: 0.4rem 0.6rem;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.radius.sm};
  }
`;

const Grid = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
`;

const Card = styled.li`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  padding: 0.9rem;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.2rem 0.5rem;
    font-size: 0.85rem;
    margin: 0;
  }
  dt {
    color: ${({ theme }) => theme.colors.inkSoft};
  }
  dd {
    margin: 0;
  }
`;

const Row2 = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const Uploads = styled.section`
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 1rem;
  border-radius: ${({ theme }) => theme.radius.md};
  margin-bottom: 2rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
`;

export default function AdminMediaPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [kind, setKind] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  const load = useCallback(async () => {
    setErr(null);
    try {
      const q = new URLSearchParams();
      if (kind) q.set("kind", kind);
      if (status) q.set("status", status);
      const data = await api<{ items: Row[]; next_cursor: string | null }>(
        `/media?${q.toString()}`
      );
      setRows(data.items);
    } catch (e) {
      setErr((e as ApiClientError).message);
      setRows([]);
    }
  }, [kind, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateAlt(id: string, alt: string) {
    try {
      await api<{ id: string }>(`/media/${id}`, { method: "PATCH", json: { alt_text: alt } });
      toast.show("Saved", "ok");
    } catch (e) {
      toast.show((e as Error).message, "error");
    }
  }

  async function toggleVisibility(id: string, next: "internal" | "public") {
    try {
      await api<{ id: string }>(`/media/${id}`, { method: "PATCH", json: { visibility: next } });
      toast.show("Updated", "ok");
      void load();
    } catch (e) {
      toast.show((e as Error).message, "error");
    }
  }

  async function flag(id: string) {
    try {
      await api(`/media/${id}/flag`, { json: { reason: "unsafe" } });
      toast.show("Flagged", "ok");
      void load();
    } catch (e) {
      toast.show((e as Error).message, "error");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this asset? Storage is cleared asynchronously.")) return;
    try {
      await api(`/media/${id}`, { method: "DELETE" });
      toast.show("Deleted", "ok");
      void load();
    } catch (e) {
      toast.show((e as Error).message, "error");
    }
  }

  return (
    <section>
      <Header>
        <h1>Media library</h1>
      </Header>

      <Uploads aria-label="Upload new media">
        <div>
          <h3>Upload a photo</h3>
          <Uploader kind="photo" onUploaded={() => void load()} />
        </div>
        <div>
          <h3>Upload a document</h3>
          <Uploader kind="document" onUploaded={() => void load()} />
        </div>
        <div>
          <h3>Upload a video</h3>
          <Uploader kind="video" viaProvider onUploaded={() => void load()} />
        </div>
      </Uploads>

      <Filters>
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Filter by kind">
          <option value="">All kinds</option>
          <option value="photo">Photos</option>
          <option value="document">Documents</option>
          <option value="video">Videos</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="ready">Ready</option>
          <option value="pending_scan">Pending scan</option>
          <option value="pending_processing">Pending processing</option>
          <option value="rejected">Rejected</option>
        </select>
      </Filters>

      {err ? <ErrorState message={err} onRetry={() => void load()} /> : null}
      {rows === null ? <LoadingState /> : null}
      {rows && rows.length === 0 ? <EmptyState title="No media yet" /> : null}

      {rows && rows.length > 0 ? (
        <Grid>
          {rows.map((r) => (
            <Card key={r.id}>
              <Row2>
                <StatusBadge status={r.status === "ready" ? "active" : "pending"}>{r.status}</StatusBadge>
                <StatusBadge status={r.visibility === "public" ? "active" : "pending"}>
                  {r.visibility}
                </StatusBadge>
                {r.exif_stripped ? <StatusBadge status="active">EXIF stripped</StatusBadge> : null}
                {r.flags.length > 0 ? <StatusBadge status="suspended">flagged</StatusBadge> : null}
              </Row2>
              <dl>
                <dt>Kind</dt>
                <dd>{r.kind}</dd>
                <dt>Type</dt>
                <dd>{r.mime}</dd>
                <dt>Size</dt>
                <dd>{formatBytes(r.bytes)}</dd>
                {r.width && r.height ? (
                  <>
                    <dt>Dim.</dt>
                    <dd>
                      {r.width}×{r.height}
                    </dd>
                  </>
                ) : null}
                <dt>Name</dt>
                <dd>{r.original_filename}</dd>
              </dl>
              <label>
                <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>Alt text</span>
                <input
                  defaultValue={r.alt_text ?? ""}
                  onBlur={(e) => void updateAlt(r.id, e.target.value)}
                  placeholder="Describe this image"
                  style={{ width: "100%", padding: "0.4rem", border: "1px solid #e5e7eb", borderRadius: 6 }}
                />
              </label>
              <Row2>
                <Button
                  variant="ghost"
                  onClick={() =>
                    toggleVisibility(r.id, r.visibility === "public" ? "internal" : "public")
                  }
                >
                  Make {r.visibility === "public" ? "internal" : "public"}
                </Button>
                <Button variant="ghost" onClick={() => flag(r.id)}>
                  Flag
                </Button>
                <Button variant="ghost" onClick={() => remove(r.id)}>
                  Delete
                </Button>
              </Row2>
            </Card>
          ))}
        </Grid>
      ) : null}
    </section>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
