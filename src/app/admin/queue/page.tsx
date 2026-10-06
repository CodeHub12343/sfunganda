"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import styled from "styled-components";
import { api, ApiClientError } from "@/lib/api";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState as LegacyEmpty, ErrorState, LoadingState } from "@/components/ui/States";
import { useFlag } from "@/lib/flags";
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  ListRow,
  SearchField,
  SegmentedControl,
  Skeleton,
  useAdminToast,
} from "@/components/admin-mobile";

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
] as const;

type State = (typeof STATES)[number];

function stateLabel(s: State): string {
  return s.replace("_", " ");
}

function stateTone(s: State): "success" | "warning" | "danger" | "neutral" | "info" | "brand" {
  if (s === "approved" || s === "published") return "success";
  if (s === "submitted" || s === "in_review") return "warning";
  if (s === "changes_requested") return "info";
  if (s === "rejected") return "danger";
  return "neutral";
}

/** Days since submission → priority bucket. */
function ageBucket(submittedAt: string | null): "high" | "normal" {
  if (!submittedAt) return "normal";
  const days = (Date.now() - new Date(submittedAt).getTime()) / 86_400_000;
  return days >= 3 ? "high" : "normal";
}

export default function QueuePage() {
  const mobile = useFlag("admin.mobileShell");
  return mobile ? <MobileQueue /> : <LegacyQueue />;
}

/* ---------------- Mobile ---------------- */

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--am-ink);
`;

const Toolbar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const List = styled.div`
  background: var(--am-surface);
  border-radius: var(--am-radius-lg);
  overflow: hidden;
  box-shadow: var(--am-shadow-1);
`;

function MobileQueue() {
  const toast = useAdminToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [state, setState] = useState<State>("submitted");
  const [query, setQuery] = useState("");
  // Rows currently animating out via optimistic approve/reject.
  const [hiding, setHiding] = useState<Set<string>>(new Set());
  const pendingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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
    const timers = pendingTimers.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, [load]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => !hiding.has(r._id))
      .filter((r) => {
        if (!q) return true;
        return (
          r.title.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q)
        );
      });
  }, [rows, query, hiding]);

  // Optimistic claim-for-review from the list. Hides the row immediately, fires
  // the API in the background, and shows a 4 s undo toast that routes the user
  // back to the item.
  async function claim(row: Row) {
    const id = row._id;
    setHiding((prev) => new Set(prev).add(id));
    toast.push({
      tone: "success",
      message: `Claimed "${row.title}" for review`,
      action: {
        label: "Open",
        onClick: () => {
          window.location.href = `/admin/queue/${id}`;
        },
      },
      ttlMs: 4000,
    });
    try {
      await api(`/accomplishments/${id}/transition`, {
        json: { transition: "claim_review", version: row.version },
      });
      // Row stays hidden; a next load() will drop it from this state bucket.
    } catch (e) {
      // Rollback.
      setHiding((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.push({
        tone: "danger",
        title: "Couldn't claim",
        message: (e as ApiClientError).message,
      });
    }
  }

  return (
    <Page>
      <Title>Review queue</Title>

      <Toolbar>
        <SegmentedControl
          label="State"
          size="sm"
          options={STATES.map((s) => ({
            value: s,
            label: stateLabel(s),
            count:
              s === state && rows ? Math.max(0, rows.length - hiding.size) : undefined,
          }))}
          value={state}
          onChange={(v) => setState(v)}
        />
        <SearchField
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
          placeholder="Search by title or summary"
        />
      </Toolbar>

      {err && (
        <Banner
          tone="danger"
          title="Couldn't load the queue"
          action={
            <Button variant="ghost" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          }
        >
          {err}
        </Banner>
      )}

      {rows === null ? (
        <List>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ padding: 16, borderBottom: "1px solid var(--am-border)" }}>
              <Skeleton height={16} width="70%" />
              <div style={{ height: 6 }} />
              <Skeleton height={12} width="40%" />
            </div>
          ))}
        </List>
      ) : filtered && filtered.length === 0 ? (
        <Card padding="none">
          <EmptyState
            title={
              rows.length === 0
                ? `Nothing in "${stateLabel(state)}"`
                : "No matches"
            }
            description={
              rows.length === 0
                ? "You're all caught up here."
                : "Try another filter or search term."
            }
          />
        </Card>
      ) : (
        <List>
          {filtered?.map((r) => {
            const prio = state === "submitted" ? ageBucket(r.submitted_at) : "normal";
            const sinceLabel = r.submitted_at
              ? ` · ${timeAgo(r.submitted_at)}`
              : "";
            const trailing =
              state === "submitted" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void claim(r);
                  }}
                >
                  Claim
                </Button>
              ) : (
                <Badge tone={stateTone(r.state as State)}>{stateLabel(r.state as State)}</Badge>
              );
            return (
              <ListRow
                key={r._id}
                href={`/admin/queue/${r._id}`}
                title={r.title}
                meta={`v${r.version} · ${r.summary || "no summary"}${sinceLabel}`}
                trailing={trailing}
                priorityColor={
                  prio === "high" ? "var(--am-danger-600)" : undefined
                }
                priorityLabel={prio === "high" ? "High — older than 3 days" : undefined}
              />
            );
          })}
        </List>
      )}
    </Page>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/* ---------------- Legacy (preserved) ---------------- */

function LegacyQueue() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [state, setState] = useState<State>("submitted");

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
            {stateLabel(s)}
          </button>
        ))}
      </div>

      {err ? <ErrorState message={err} onRetry={() => void load()} /> : null}
      {rows === null ? <LoadingState /> : null}
      {rows && rows.length === 0 ? <LegacyEmpty title="Nothing in this bucket" /> : null}
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
                <StatusBadge tone={r.state === "published" ? "success" : "warning"}>
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
