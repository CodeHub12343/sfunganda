"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { DataTable, type Column } from "@/components/ui/DataTable";
import {
  EmptyState as LegacyEmpty,
  ErrorState,
  LoadingState,
} from "@/components/ui/States";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api, ApiClientError } from "@/lib/api";
import { useFlag } from "@/lib/flags";
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  FilterChip,
  SearchField,
  Sheet,
  Skeleton,
} from "@/components/admin-mobile";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  at: string;
  action: string;
  actor_id: string | null;
  actor_role: string | null;
  entity_type: string;
  entity_id: string | null;
  before: unknown;
  after: unknown;
  request_id: string;
};

const PAGE_SIZE = 50;

export default function AuditPage() {
  const mobile = useFlag("admin.mobileShell");
  return mobile ? <MobileAudit /> : <LegacyAudit />;
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

const Chips = styled.div`
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const JumpBar = styled.div`
  position: sticky;
  top: 56px;
  z-index: 2;
  display: flex;
  gap: 8px;
  padding: 8px 0;
  background: var(--am-bg);
`;

const JumpInput = styled.input`
  flex: 1 1 auto;
  min-height: 36px;
  padding: 0 12px;
  border-radius: var(--am-radius-md);
  background: var(--am-surface);
  color: var(--am-ink);
  border: 1px solid var(--am-border-strong);
  font-family: inherit;
  font-size: 14px;
`;

const DayGroup = styled.section`
  margin-top: 8px;
`;

const DayHeader = styled.h2`
  position: sticky;
  top: 100px;
  z-index: 1;
  margin: 0 0 8px;
  padding: 6px 12px;
  background: var(--am-bg-soft);
  border-radius: var(--am-radius-md);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--am-ink-muted);
`;

const Timeline = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
`;

const Item = styled.li`
  display: flex;
  gap: 12px;
  padding: 10px 0;
  & + & {
    border-top: 1px solid var(--am-border);
  }
`;

const Dot = styled.span<{ $tone: "info" | "success" | "warning" | "danger" }>`
  flex-shrink: 0;
  margin-top: 4px;
  width: 10px;
  height: 10px;
  border-radius: var(--am-radius-pill);
  background: ${({ $tone }) =>
    $tone === "success"
      ? "var(--am-success-600)"
      : $tone === "warning"
        ? "var(--am-warning-600)"
        : $tone === "danger"
          ? "var(--am-danger-600)"
          : "var(--am-info-600)"};
  box-shadow: 0 0 0 3px
    ${({ $tone }) =>
      $tone === "success"
        ? "var(--am-success-50)"
        : $tone === "warning"
          ? "var(--am-warning-50)"
          : $tone === "danger"
            ? "var(--am-danger-50)"
            : "var(--am-info-50)"};
`;

const ItemBody = styled.button`
  flex: 1 1 auto;
  text-align: left;
  background: transparent;
  border: 0;
  padding: 0;
  cursor: pointer;
  font-family: inherit;
  color: var(--am-ink);
  min-width: 0;
  &:focus-visible {
    outline: 2px solid var(--am-brand-500);
    outline-offset: 2px;
    border-radius: var(--am-radius-sm);
  }
`;

const ItemTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: var(--am-ink);
`;

const ItemMeta = styled.div`
  font-size: 12px;
  color: var(--am-ink-muted);
  margin-top: 2px;
`;

const Mono = styled.span`
  font-family: ui-monospace, Menlo, monospace;
`;

const DiffPre = styled.pre`
  margin: 0;
  padding: 12px;
  background: var(--am-bg-soft);
  border-radius: var(--am-radius-md);
  overflow-x: auto;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
  line-height: 18px;
  color: var(--am-ink);
`;

const DiffLine = styled.div<{ $kind: "same" | "add" | "del" | "change" }>`
  padding: 2px 6px;
  white-space: pre-wrap;
  background: ${({ $kind }) =>
    $kind === "add"
      ? "rgba(5, 150, 105, 0.12)"
      : $kind === "del"
        ? "rgba(220, 38, 38, 0.12)"
        : $kind === "change"
          ? "rgba(2, 132, 199, 0.12)"
          : "transparent"};
  color: ${({ $kind }) =>
    $kind === "add"
      ? "var(--am-success-600)"
      : $kind === "del"
        ? "var(--am-danger-600)"
        : $kind === "change"
          ? "var(--am-info-600)"
          : "var(--am-ink)"};
`;

function toneForAction(action: string): "info" | "success" | "warning" | "danger" {
  if (/create|publish|approve|post|activate/.test(action)) return "success";
  if (/reject|delete|reverse|suspend|void/.test(action)) return "danger";
  if (/pending|request/.test(action)) return "warning";
  return "info";
}

function badgeTone(action: string): "info" | "success" | "warning" | "danger" | "brand" | "neutral" {
  return toneForAction(action);
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Compute a compact key-path diff between `before` and `after` JSON. We keep
 * it in-house rather than take a `jsondiffpatch` dependency — the API only
 * stores shallow entity snapshots, so a key-path walk is both smaller and more
 * readable than a full character-level diff on mobile. */
type DiffRow = { kind: "add" | "del" | "change" | "same"; path: string; from?: unknown; to?: unknown };

function diffJson(before: unknown, after: unknown, path = ""): DiffRow[] {
  if (before === after) return [];
  const isObj = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);
  if (isObj(before) && isObj(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    const rows: DiffRow[] = [];
    for (const k of keys) {
      const child = path ? `${path}.${k}` : k;
      const b = before[k];
      const a = after[k];
      if (b === undefined && a !== undefined) {
        rows.push({ kind: "add", path: child, to: a });
      } else if (a === undefined && b !== undefined) {
        rows.push({ kind: "del", path: child, from: b });
      } else {
        rows.push(...diffJson(b, a, child));
      }
    }
    return rows.filter((r) => r.kind !== "same");
  }
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (before === undefined || before === null) {
    return [{ kind: "add", path, to: after }];
  }
  if (after === undefined || after === null) {
    return [{ kind: "del", path, from: before }];
  }
  return [{ kind: "change", path, from: before, to: after }];
}

function renderValue(v: unknown): string {
  if (v === undefined) return "undefined";
  if (v === null) return "null";
  if (typeof v === "string") return `"${v}"`;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 120 ? `${s.slice(0, 117)}…` : s;
  } catch {
    return String(v);
  }
}

function MobileAudit() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [jumpDate, setJumpDate] = useState<string>("");
  const [detail, setDetail] = useState<Row | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const data = await api<Row[]>("/audit/");
      // Sort newest first; the API order is not guaranteed.
      const sorted = [...data].sort(
        (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
      );
      setRows(sorted);
      setVisibleCount(PAGE_SIZE);
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Could not load audit log.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const actionTypes = useMemo(() => {
    if (!rows) return [];
    const freq = new Map<string, number>();
    for (const r of rows) freq.set(r.action, (freq.get(r.action) ?? 0) + 1);
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([k]) => k);
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (actionFilter !== "all" && r.action !== actionFilter) return false;
      if (!q) return true;
      return (
        r.action.toLowerCase().includes(q) ||
        r.entity_type.toLowerCase().includes(q) ||
        (r.entity_id ?? "").toLowerCase().includes(q) ||
        (r.actor_id ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, actionFilter]);

  const visible = useMemo(
    () => (filtered ? filtered.slice(0, visibleCount) : null),
    [filtered, visibleCount]
  );

  // Infinite scroll — observe sentinel at the bottom.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !filtered) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisibleCount((c) => Math.min(c + PAGE_SIZE, filtered.length));
          }
        }
      },
      { rootMargin: "400px 0px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [filtered]);

  const grouped = useMemo(() => {
    if (!visible) return [];
    const map = new Map<string, Row[]>();
    for (const r of visible) {
      const key = dayKey(r.at);
      const bucket = map.get(key) ?? [];
      bucket.push(r);
      map.set(key, bucket);
    }
    return [...map.entries()];
  }, [visible]);

  function doJump() {
    if (!filtered || !jumpDate) return;
    // Jump to the first entry on or before the chosen date.
    const target = new Date(`${jumpDate}T23:59:59`);
    const idx = filtered.findIndex((r) => new Date(r.at) <= target);
    if (idx === -1) return;
    // Reveal enough rows and scroll to the day group.
    setVisibleCount(Math.max(visibleCount, idx + PAGE_SIZE));
    requestAnimationFrame(() => {
      const key = dayKey(filtered[idx].at);
      const target = document.querySelector<HTMLHeadingElement>(
        `[data-day="${key}"]`
      );
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <Page>
      <Title>Audit log</Title>

      <SearchField
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onClear={() => setQuery("")}
        placeholder="Search action, entity, actor"
      />

      <Chips>
        <FilterChip active={actionFilter === "all"} onClick={() => setActionFilter("all")}>
          All actions
        </FilterChip>
        {actionTypes.map((a) => (
          <FilterChip
            key={a}
            active={actionFilter === a}
            onClick={() => setActionFilter(a)}
          >
            {a}
          </FilterChip>
        ))}
      </Chips>

      <JumpBar>
        <JumpInput
          type="date"
          value={jumpDate}
          onChange={(e) => setJumpDate(e.target.value)}
          aria-label="Jump to date"
        />
        <Button variant="secondary" size="sm" onClick={doJump} disabled={!jumpDate}>
          Jump
        </Button>
      </JumpBar>

      {err && (
        <Banner tone="danger" title="Couldn't load audit log" action={
          <Button variant="ghost" size="sm" onClick={() => void load()}>Retry</Button>
        }>
          {err}
        </Banner>
      )}

      {rows === null ? (
        <Card>
          <Skeleton height={16} width="60%" />
          <div style={{ height: 8 }} />
          <Skeleton height={12} width="40%" />
          <div style={{ height: 16 }} />
          <Skeleton height={16} width="70%" />
        </Card>
      ) : filtered && filtered.length === 0 ? (
        <Card padding="none">
          <EmptyState
            title={rows.length === 0 ? "No audit rows yet" : "No matches"}
            description={
              rows.length === 0
                ? "Admin actions appear here as they happen."
                : "Try a different filter or search."
            }
          />
        </Card>
      ) : (
        grouped.map(([day, items]) => (
          <DayGroup key={day}>
            <DayHeader data-day={day}>{day}</DayHeader>
            <Card padding="md">
              <Timeline>
                {items.map((r) => (
                  <Item key={r.id}>
                    <Dot $tone={toneForAction(r.action)} />
                    <ItemBody type="button" onClick={() => setDetail(r)}>
                      <ItemTitle>
                        <Badge tone={badgeTone(r.action)}>{r.action}</Badge>{" "}
                        <span style={{ marginLeft: 6 }}>{r.entity_type}</span>
                        {r.entity_id && (
                          <Mono style={{ color: "var(--am-ink-muted)" }}>
                            {" "}
                            · {r.entity_id.slice(-6)}
                          </Mono>
                        )}
                      </ItemTitle>
                      <ItemMeta>
                        {timeOf(r.at)}
                        {r.actor_role && ` · ${r.actor_role}`}
                        {r.actor_id && (
                          <>
                            {" · "}
                            <Mono>{r.actor_id.slice(-6)}</Mono>
                          </>
                        )}
                        {" · req "}
                        <Mono>{(r.request_id ?? "").slice(-8) || "—"}</Mono>
                      </ItemMeta>
                    </ItemBody>
                  </Item>
                ))}
              </Timeline>
            </Card>
          </DayGroup>
        ))
      )}

      {filtered && visible && visible.length < filtered.length && (
        <div ref={sentinelRef} style={{ padding: 16, textAlign: "center" }}>
          <span style={{ fontSize: 12, color: "var(--am-ink-subtle)" }}>
            Loading more…
          </span>
        </div>
      )}

      <Sheet
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.action} · ${detail.entity_type}` : ""}
        description={
          detail ? new Date(detail.at).toLocaleString() : undefined
        }
      >
        {detail && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <KV k="Actor" v={detail.actor_id ? <Mono>{detail.actor_id}</Mono> : "—"} />
              <KV k="Actor role" v={detail.actor_role ?? "—"} />
              <KV k="Entity id" v={detail.entity_id ? <Mono>{detail.entity_id}</Mono> : "—"} />
              <KV k="Request id" v={<Mono>{detail.request_id}</Mono>} />
            </div>
            <div style={{ height: 16 }} />
            <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 600 }}>Changes</h3>
            <JsonDiffView before={detail.before} after={detail.after} />
          </>
        )}
      </Sheet>
    </Page>
  );
}

const KVRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  background: var(--am-bg-soft);
  border-radius: var(--am-radius-md);
  font-size: 13px;
`;

const KVKey = styled.span`
  color: var(--am-ink-muted);
`;

const KVVal = styled.span`
  color: var(--am-ink);
  font-weight: 600;
  min-width: 0;
  overflow-wrap: anywhere;
`;

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <KVRow>
      <KVKey>{k}</KVKey>
      <KVVal>{v}</KVVal>
    </KVRow>
  );
}

function JsonDiffView({ before, after }: { before: unknown; after: unknown }) {
  const rows = useMemo(() => diffJson(before, after), [before, after]);
  if (rows.length === 0) {
    return (
      <p style={{ color: "var(--am-ink-muted)", fontSize: 13 }}>
        No field changes recorded.
      </p>
    );
  }
  return (
    <DiffPre>
      {rows.map((r, i) => {
        if (r.kind === "change") {
          return (
            <div key={i}>
              <DiffLine $kind="del">
                - {r.path}: {renderValue(r.from)}
              </DiffLine>
              <DiffLine $kind="add">
                + {r.path}: {renderValue(r.to)}
              </DiffLine>
            </div>
          );
        }
        return (
          <DiffLine key={i} $kind={r.kind}>
            {r.kind === "add" ? "+" : r.kind === "del" ? "-" : " "} {r.path}:{" "}
            {renderValue(r.kind === "add" ? r.to : r.from)}
          </DiffLine>
        );
      })}
    </DiffPre>
  );
}

/* ---------------- Legacy (preserved) ---------------- */

const LegacyHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 1.5rem;
  h2 {
    font-family: ${({ theme }) => theme.font.heading};
    color: ${({ theme }) => theme.colors.trustBlue};
    font-size: 1.6rem;
    margin: 0;
  }
`;

function LegacyAudit() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const data = await api<Row[]>("/audit/");
      setRows(data);
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Could not load audit log.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: Column<Row>[] = [
    {
      key: "at",
      header: "When",
      render: (r) => new Date(r.at).toLocaleString(),
      width: "180px",
    },
    {
      key: "action",
      header: "Action",
      render: (r) => <StatusBadge tone="info">{r.action}</StatusBadge>,
    },
    {
      key: "entity",
      header: "Entity",
      render: (r) =>
        `${r.entity_type}${r.entity_id ? " · " + r.entity_id.slice(-6) : ""}`,
    },
    {
      key: "actor",
      header: "Actor",
      render: (r) => (r.actor_id ? r.actor_id.slice(-6) : "—"),
    },
    {
      key: "request_id",
      header: "Request",
      render: (r) => <code>{(r.request_id ?? "").slice(-8) || "—"}</code>,
    },
  ];

  return (
    <div>
      <LegacyHeader>
        <h2>Audit log</h2>
      </LegacyHeader>
      {err ? (
        <ErrorState message={err} retry={load} />
      ) : rows === null ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <LegacyEmpty title="No audit rows yet" description="Admin actions appear here as they happen." />
      ) : (
        <DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} />
      )}
    </div>
  );
}
