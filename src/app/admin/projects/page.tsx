"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styled from "styled-components";
import { api, ApiClientError } from "@/lib/api";
import { Button as LegacyButton } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState as LegacyEmpty, ErrorState, LoadingState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
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
  amMedia,
  useAdminToast,
} from "@/components/admin-mobile";

export const dynamic = "force-dynamic";

type Project = {
  _id: string;
  name: string;
  slug: string;
  status: string;
  progress_pct: number;
  milestone_counts: { total: number; complete: number };
  community_id: string;
  version: number;
};

type Community = { _id: string; name: string; slug: string };

export default function AdminProjects() {
  const mobile = useFlag("admin.mobileShell");
  return mobile ? <MobileProjects /> : <LegacyProjects />;
}

/* ---------------- Mobile ---------------- */

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const PageTitle = styled.h1`
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

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;

  ${amMedia.md} {
    grid-template-columns: 1fr 1fr;
  }
  ${amMedia.lg} {
    grid-template-columns: 1fr 1fr 1fr;
  }
`;

const ProjectCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const CardHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
`;

const CardTitle = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--am-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

const CardSlug = styled.div`
  font-size: 12px;
  color: var(--am-ink-subtle);
  margin-top: 2px;
`;

const Progress = styled.div<{ $pct: number }>`
  position: relative;
  height: 6px;
  width: 100%;
  background: var(--am-bg-soft);
  border-radius: var(--am-radius-pill);
  overflow: hidden;
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    width: ${({ $pct }) => Math.max(0, Math.min(100, $pct))}%;
    background: var(--am-brand-500);
    border-radius: inherit;
    transition: width var(--am-dur-slow) var(--am-ease-standard);
  }
`;

const KPI = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--am-ink-muted);
`;

const KPINum = styled.span`
  font-weight: 700;
  color: var(--am-ink);
  font-variant-numeric: tabular-nums;
`;

const Fab = styled.button`
  position: fixed;
  right: 16px;
  bottom: calc(80px + env(safe-area-inset-bottom));
  width: 56px;
  height: 56px;
  border-radius: var(--am-radius-pill);
  background: var(--am-brand-600);
  color: var(--am-ink-on-brand);
  border: 0;
  box-shadow: var(--am-shadow-3);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  z-index: var(--am-z-sticky);
  &:focus-visible {
    outline: 2px solid var(--am-brand-500);
    outline-offset: 4px;
  }
  &:active {
    transform: scale(0.96);
  }
  ${amMedia.lg} {
    display: none;
  }
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--am-ink-muted);
`;

const Input = styled.input`
  min-height: 44px;
  padding: 0 12px;
  border-radius: var(--am-radius-md);
  background: var(--am-surface);
  color: var(--am-ink);
  border: 1px solid var(--am-border-strong);
  font-family: inherit;
  font-size: 15px;
  &:focus {
    outline: 2px solid var(--am-brand-500);
    outline-offset: 2px;
    border-color: var(--am-brand-500);
  }
`;

const Textarea = styled.textarea`
  min-height: 88px;
  padding: 10px 12px;
  border-radius: var(--am-radius-md);
  background: var(--am-surface);
  color: var(--am-ink);
  border: 1px solid var(--am-border-strong);
  font-family: inherit;
  font-size: 15px;
  resize: vertical;
  &:focus {
    outline: 2px solid var(--am-brand-500);
    outline-offset: 2px;
    border-color: var(--am-brand-500);
  }
`;

const Select = styled.select`
  min-height: 44px;
  padding: 0 12px;
  border-radius: var(--am-radius-md);
  background: var(--am-surface);
  color: var(--am-ink);
  border: 1px solid var(--am-border-strong);
  font-family: inherit;
  font-size: 15px;
`;

const DesktopNew = styled.div`
  display: none;
  ${amMedia.lg} {
    display: flex;
    justify-content: flex-end;
  }
`;

const STATUSES = ["planning", "active", "paused", "completed", "archived"] as const;
type Status = (typeof STATUSES)[number] | "all";

function statusTone(s: string): "success" | "warning" | "neutral" | "danger" | "info" {
  if (s === "active") return "success";
  if (s === "planning" || s === "paused") return "warning";
  if (s === "completed") return "info";
  if (s === "archived") return "neutral";
  return "neutral";
}

function MobileProjects() {
  const toast = useAdminToast();
  const [rows, setRows] = useState<Project[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", community_id: "", summary: "" });
  const [newCommunity, setNewCommunity] = useState({ name: "", region_label: "" });
  const isAddingCommunity = form.community_id === "__new__";
  const canSubmit = Boolean(
    form.name && form.slug && form.summary &&
    (isAddingCommunity ? newCommunity.name && newCommunity.region_label : form.community_id)
  );

  const load = useCallback(async () => {
    setErr(null);
    try {
      const data = await api<{ items: Project[]; next_cursor: string | null }>(
        "/projects?limit=100"
      );
      setRows(data.items);
    } catch (e) {
      setErr((e as ApiClientError).message);
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
    void api<Community[]>("/projects/communities")
      .then((d) => setCommunities(d))
      .catch(() => setCommunities([]));
  }, [load]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = query.trim().toLowerCase();
    return rows.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
    });
  }, [rows, query, status]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: rows?.length ?? 0 };
    for (const s of STATUSES) m[s] = rows?.filter((r) => r.status === s).length ?? 0;
    return m;
  }, [rows]);

  async function create() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      let community_id = form.community_id;
      if (isAddingCommunity) {
        const slugged = newCommunity.name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 120);
        const created = await api<{ _id: string; name: string; slug: string; region_label: string }>(
          "/projects/communities",
          {
            json: {
              name: newCommunity.name,
              slug: slugged,
              region_label: newCommunity.region_label,
            },
          }
        );
        community_id = created._id;
        setCommunities((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      }
      await api("/projects", {
        json: {
          name: form.name,
          slug: form.slug,
          community_id,
          summary: form.summary,
          status: "planning",
        },
      });
      toast.push({ tone: "success", message: "Project created" });
      setForm({ name: "", slug: "", community_id, summary: "" });
      setNewCommunity({ name: "", region_label: "" });
      setCreateOpen(false);
      void load();
    } catch (e) {
      toast.push({ tone: "danger", message: (e as ApiClientError).message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Page>
      <PageTitle>Projects</PageTitle>

      <Toolbar>
        <SearchField
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
          placeholder="Search projects"
        />
        <Chips>
          <FilterChip
            active={status === "all"}
            onClick={() => setStatus("all")}
            count={counts.all}
          >
            All
          </FilterChip>
          {STATUSES.map((s) => (
            <FilterChip
              key={s}
              active={status === s}
              onClick={() => setStatus(s)}
              count={counts[s]}
            >
              {s}
            </FilterChip>
          ))}
        </Chips>
        <DesktopNew>
          <Button onClick={() => setCreateOpen(true)}>+ New project</Button>
        </DesktopNew>
      </Toolbar>

      {err && (
        <Banner tone="danger" title="Couldn't load projects" action={
          <Button variant="ghost" size="sm" onClick={() => void load()}>Retry</Button>
        }>
          {err}
        </Banner>
      )}

      {rows === null ? (
        <Grid>
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <Skeleton height={18} width="70%" />
              <div style={{ height: 10 }} />
              <Skeleton height={12} width="40%" />
              <div style={{ height: 16 }} />
              <Skeleton height={6} />
            </Card>
          ))}
        </Grid>
      ) : filtered && filtered.length === 0 ? (
        <Card padding="none">
          <EmptyState
            title={rows.length === 0 ? "No projects yet" : "No matches"}
            description={
              rows.length === 0
                ? "Create your first project to get started."
                : "Try a different search or filter."
            }
            action={
              rows.length === 0 ? (
                <Button onClick={() => setCreateOpen(true)}>+ New project</Button>
              ) : (
                <Button variant="ghost" onClick={() => { setQuery(""); setStatus("all"); }}>
                  Clear filters
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <Grid>
          {filtered?.map((p) => (
            <Link
              key={p._id}
              href={`/admin/projects/${p._id}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <ProjectCard variant="default" interactive>
                <CardHead>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <CardTitle>{p.name}</CardTitle>
                    <CardSlug>{p.slug}</CardSlug>
                  </div>
                  <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                </CardHead>
                <Progress $pct={p.progress_pct} aria-label={`${p.progress_pct}% complete`} />
                <KPI>
                  <span>
                    Milestones{" "}
                    <KPINum>
                      {p.milestone_counts.complete}/{p.milestone_counts.total}
                    </KPINum>
                  </span>
                  <span>
                    Progress <KPINum>{p.progress_pct}%</KPINum>
                  </span>
                </KPI>
              </ProjectCard>
            </Link>
          ))}
        </Grid>
      )}

      <Fab type="button" aria-label="New project" onClick={() => setCreateOpen(true)}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </Fab>

      <Sheet
        open={createOpen}
        onClose={() => (submitting ? undefined : setCreateOpen(false))}
        title="New project"
        description="A new project starts in planning. You can activate it later."
        dismissible={!submitting}
        footer={
          <>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setCreateOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              fullWidth
              loading={submitting}
              onClick={create}
              disabled={!canSubmit}
            >
              Create
            </Button>
          </>
        }
      >
        <FormGrid>
          <Field>
            <span>Name</span>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Clean Water Initiative"
              autoFocus
            />
          </Field>
          <Field>
            <span>Slug</span>
            <Input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="clean-water"
              autoCapitalize="none"
              spellCheck={false}
            />
          </Field>
          <Field>
            <span>Community</span>
            <Select
              value={form.community_id}
              onChange={(e) => setForm({ ...form, community_id: e.target.value })}
            >
              <option value="">Pick a community…</option>
              {communities.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
              <option value="__new__">+ Add new community…</option>
            </Select>
          </Field>
          {isAddingCommunity && (
            <>
              <Field>
                <span>New community name</span>
                <Input
                  value={newCommunity.name}
                  onChange={(e) => setNewCommunity({ ...newCommunity, name: e.target.value })}
                  placeholder="e.g. Kampala Metro"
                />
              </Field>
              <Field>
                <span>Region label</span>
                <Input
                  value={newCommunity.region_label}
                  onChange={(e) =>
                    setNewCommunity({ ...newCommunity, region_label: e.target.value })
                  }
                  placeholder="e.g. Central Uganda"
                />
              </Field>
            </>
          )}
          <Field>
            <span>Summary</span>
            <Textarea
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              placeholder="A short description of this project."
            />
          </Field>
        </FormGrid>
      </Sheet>
    </Page>
  );
}

/* ---------------- Legacy (unchanged) ---------------- */

function LegacyProjects() {
  const toast = useToast();
  const [rows, setRows] = useState<Project[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [form, setForm] = useState({ name: "", slug: "", community_id: "", summary: "" });

  const load = useCallback(async () => {
    setErr(null);
    try {
      const data = await api<{ items: Project[]; next_cursor: string | null }>(
        "/projects?limit=100"
      );
      setRows(data.items);
    } catch (e) {
      setErr((e as ApiClientError).message);
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
    void api<Community[]>("/projects/communities")
      .then((d) => setCommunities(d))
      .catch(() => setCommunities([]));
  }, [load]);

  async function create() {
    try {
      await api("/projects", {
        json: {
          name: form.name,
          slug: form.slug,
          community_id: form.community_id,
          summary: form.summary,
          status: "planning",
        },
      });
      toast.push({ tone: "success", message: "Project created" });
      setForm({ name: "", slug: "", community_id: form.community_id, summary: "" });
      void load();
    } catch (e) {
      toast.push({ tone: "danger", message: (e as ApiClientError).message });
    }
  }

  return (
    <section>
      <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Projects</h1>

      <section
        style={{
          marginTop: "1.5rem",
          padding: "1rem 1.25rem",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          background: "#fff",
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: "1rem" }}>New project</h2>
        <div style={{ display: "grid", gap: "0.6rem", gridTemplateColumns: "1fr 1fr" }}>
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            style={legacyInput}
          />
          <input
            placeholder="slug"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            style={legacyInput}
          />
          <select
            value={form.community_id}
            onChange={(e) => setForm({ ...form, community_id: e.target.value })}
            style={legacyInput}
          >
            <option value="">Pick a community…</option>
            {communities.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Summary"
            value={form.summary}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
            style={legacyInput}
          />
        </div>
        <div style={{ marginTop: "0.75rem" }}>
          <LegacyButton
            variant="primary"
            onClick={create}
            disabled={!form.name || !form.slug || !form.community_id || !form.summary}
          >
            Create
          </LegacyButton>
        </div>
      </section>

      {err ? <ErrorState message={err} onRetry={() => void load()} /> : null}
      {rows === null ? <LoadingState /> : null}
      {rows && rows.length === 0 ? <LegacyEmpty title="No projects yet" /> : null}
      {rows && rows.length > 0 ? (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            marginTop: "1.5rem",
            display: "grid",
            gap: "0.75rem",
          }}
        >
          {rows.map((p) => (
            <li
              key={p._id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: "1rem 1.25rem",
                background: "#fff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.05rem" }}>
                    <Link href={`/admin/projects/${p._id}`}>{p.name}</Link>
                  </h2>
                  <small style={{ color: "#6b7280" }}>
                    {p.slug} · {p.milestone_counts.complete}/{p.milestone_counts.total}{" "}
                    milestones · {p.progress_pct}% complete
                  </small>
                </div>
                <StatusBadge tone={p.status === "active" ? "active" : "pending"}>
                  {p.status}
                </StatusBadge>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

const legacyInput: React.CSSProperties = {
  padding: "0.55rem 0.7rem",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
};
