"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { api, ApiClientError } from "@/lib/api";
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  FilterChip,
  ListRow,
  SearchField,
  Skeleton,
} from "@/components/admin-mobile";

export const dynamic = "force-dynamic";

type Row = {
  _id: string;
  public_id: string | null;
  title: string;
  summary: string;
  state: string;
  occurred_on: string;
  published_at: string | null;
  project_id: string;
  beneficiary_count: number | null;
  version: number;
};

type Project = { _id: string; name: string; slug: string };

const STATES = [
  "draft",
  "submitted",
  "in_review",
  "changes_requested",
  "approved",
  "published",
  "rejected",
  "archived",
] as const;

type StateFilter = (typeof STATES)[number] | "all";

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
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

const List = styled.div`
  background: var(--am-surface);
  border-radius: var(--am-radius-lg);
  overflow: hidden;
  box-shadow: var(--am-shadow-1);
`;

function stateTone(s: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (s === "published" || s === "approved") return "success";
  if (s === "submitted" || s === "in_review" || s === "changes_requested") return "warning";
  if (s === "rejected") return "danger";
  if (s === "draft") return "info";
  return "neutral";
}

export default function AdminAccomplishmentsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [state, setState] = useState<StateFilter>("all");
  const [query, setQuery] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const stateParam = state === "all" ? "" : `?state=${state}`;
      const [a, p] = await Promise.all([
        api<{ items: Row[]; next_cursor: string | null }>(`/accomplishments${stateParam}`),
        api<{ items: Project[] }>("/projects").catch(() => ({ items: [] as Project[] })),
      ]);
      setRows(a.items);
      setProjects(p.items ?? []);
    } catch (e) {
      setErr((e as ApiClientError).message);
    }
  }, [state]);

  useEffect(() => {
    void load();
  }, [load]);

  const projectMap = useMemo(() => {
    const m = new Map<string, Project>();
    projects.forEach((p) => m.set(p._id, p));
    return m;
  }, [projects]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q) ||
        (r.public_id ?? "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  return (
    <Page>
      <Header>
        <Title>Accomplishments</Title>
        <Link href="/admin/accomplishments/new" style={{ textDecoration: "none" }}>
          <Button variant="primary" size="md">
            + New accomplishment
          </Button>
        </Link>
      </Header>

      {err && (
        <Banner
          tone="danger"
          title="Couldn't load"
          action={
            <Button variant="ghost" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          }
        >
          {err}
        </Banner>
      )}

      <SearchField
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onClear={() => setQuery("")}
        placeholder="Search by title, summary, or id"
      />

      <Chips>
        <FilterChip active={state === "all"} onClick={() => setState("all")}>
          All
        </FilterChip>
        {STATES.map((s) => (
          <FilterChip key={s} active={state === s} onClick={() => setState(s)}>
            {s.replace("_", " ")}
          </FilterChip>
        ))}
      </Chips>

      {filtered === null ? (
        <List>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{ padding: 16, borderBottom: "1px solid var(--am-border)" }}
            >
              <Skeleton height={16} width="70%" />
              <div style={{ height: 6 }} />
              <Skeleton height={12} width="40%" />
            </div>
          ))}
        </List>
      ) : filtered.length === 0 ? (
        <Card padding="none">
          <EmptyState
            title="Nothing here yet"
            description="Create a new accomplishment, then submit it for review and publish."
          />
        </Card>
      ) : (
        <List>
          {filtered.map((r) => {
            const project = projectMap.get(r.project_id);
            return (
              <ListRow
                key={r._id}
                href={`/admin/accomplishments/${r._id}`}
                title={r.title}
                meta={`${project?.name ?? "unknown project"} · ${new Date(r.occurred_on).toLocaleDateString()}${r.public_id ? ` · ${r.public_id}` : ""}`}
                trailing={<Badge tone={stateTone(r.state)}>{r.state.replace("_", " ")}</Badge>}
              />
            );
          })}
        </List>
      )}
    </Page>
  );
}
