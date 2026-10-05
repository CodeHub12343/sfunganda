"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

type Row = {
  _id: string;
  topic: string;
  title: string;
  body: string;
  url: string | null;
  read_at: string | null;
  created_at: string;
};

export default function NotificationsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const data = await api<{ items: Row[]; next_cursor: string | null }>(
        `/me/notifications?${unreadOnly ? "unread=1&" : ""}limit=50`
      );
      setRows(data.items);
    } catch (e) {
      setErr((e as ApiClientError).message);
    }
  }, [unreadOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markAllRead() {
    await api("/me/notifications/mark-read", { json: { all: true } });
    void load();
  }

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1>Notifications</h1>
        <Button variant="ghost" onClick={markAllRead}>
          Mark all read
        </Button>
      </div>
      <label style={{ display: "block", margin: "0.75rem 0" }}>
        <input
          type="checkbox"
          checked={unreadOnly}
          onChange={(e) => setUnreadOnly(e.target.checked)}
        />{" "}
        Unread only
      </label>

      {err ? <ErrorState message={err} onRetry={() => void load()} /> : null}
      {rows === null ? <LoadingState /> : null}
      {rows && rows.length === 0 ? <EmptyState title="You're all caught up." /> : null}
      {rows && rows.length > 0 ? (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.5rem" }}>
          {rows.map((n) => (
            <li
              key={n._id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: "0.9rem 1.2rem",
                background: n.read_at ? "#f9fafb" : "#fff",
                borderLeft: n.read_at ? "4px solid #e5e7eb" : "4px solid #f59e0b",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                <strong>
                  {n.url ? <Link href={n.url}>{n.title}</Link> : n.title}
                </strong>
                <small style={{ color: "#6b7280" }}>
                  {new Date(n.created_at).toLocaleString()}
                </small>
              </div>
              {n.body ? <p style={{ margin: "0.4rem 0 0" }}>{n.body}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
