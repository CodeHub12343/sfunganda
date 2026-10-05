"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readLocalDrafts, type LocalDraft } from "./localDrafts";

export const dynamic = "force-dynamic";

export default function FieldHome() {
  const [drafts, setDrafts] = useState<LocalDraft[]>([]);
  useEffect(() => {
    setDrafts(readLocalDrafts());
  }, []);
  return (
    <div>
      <Link
        href="/field/new"
        style={{
          display: "block",
          padding: "1rem 1.25rem",
          background: "#111827",
          color: "#fff",
          textAlign: "center",
          borderRadius: 10,
          marginBottom: "1.5rem",
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        + Record an accomplishment
      </Link>

      <h2 style={{ fontSize: "1rem", color: "#6b7280" }}>Local drafts</h2>
      {drafts.length === 0 ? (
        <p style={{ color: "#6b7280" }}>No drafts saved on this device.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.75rem" }}>
          {drafts.map((d) => (
            <li
              key={d.local_id}
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: "0.9rem 1.1rem",
              }}
            >
              <Link href={`/field/draft/${d.local_id}`}>
                <strong>{d.title || "Untitled draft"}</strong>
              </Link>
              <div style={{ color: "#6b7280", fontSize: "0.85rem" }}>
                last saved {new Date(d.saved_at).toLocaleString()}
                {d.remote_id ? ` · synced (${d.remote_id.slice(0, 6)}…)` : " · not synced"}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
