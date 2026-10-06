"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";

// =============================================================================
// Shows social-post rows for one accomplishment. Rendered on the
// accomplishment review page so an approver can see where the video
// went and retry a failed post without leaving the page.
// =============================================================================

type Post = {
  id: string;
  platform: string;
  state: "queued" | "posting" | "posted" | "failed" | "skipped";
  external_url: string | null;
  attempts: number;
  last_error: string | null;
  skip_reason: string | null;
};

export function PostStatusList({ accomplishmentId }: { accomplishmentId: string }) {
  const toast = useToast();
  const [rows, setRows] = useState<Post[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<Post[]>(`/social/posts?accomplishment_id=${encodeURIComponent(accomplishmentId)}`);
      setRows(r);
    } catch {
      // ignore — status is informational
    } finally {
      setLoaded(true);
    }
  }, [accomplishmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function retry(id: string) {
    try {
      await api(`/social/posts/${id}/retry`, { json: {} });
      toast.show("Retry queued", "ok");
      await load();
    } catch (e) {
      toast.show((e as ApiClientError).message, "error");
    }
  }

  if (!loaded || rows.length === 0) return null;

  return (
    <section
      style={{
        marginTop: "1rem",
        padding: "0.75rem 1rem",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        background: "#f9fafb",
      }}
    >
      <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>Social cross-posts</h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {rows.map((r) => (
          <li
            key={r.id}
            style={{
              display: "flex",
              gap: "0.75rem",
              alignItems: "center",
              padding: "0.3rem 0",
              borderBottom: "1px dashed #e5e7eb",
            }}
          >
            <strong style={{ textTransform: "capitalize", minWidth: 90 }}>{r.platform}</strong>
            <span style={{
              color: r.state === "posted" ? "#15803d" :
                     r.state === "failed" ? "#b91c1c" :
                     r.state === "skipped" ? "#92400e" :
                     "#374151",
              minWidth: 60,
            }}>{r.state}</span>
            {r.external_url ? (
              <a href={r.external_url} target="_blank" rel="noreferrer">open</a>
            ) : null}
            <small style={{ color: "#6b7280", flex: 1 }}>
              {r.last_error ?? r.skip_reason ?? ""}
            </small>
            {(r.state === "failed" || r.state === "skipped") ? (
              <Button variant="ghost" onClick={() => void retry(r.id)}>Retry</Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
