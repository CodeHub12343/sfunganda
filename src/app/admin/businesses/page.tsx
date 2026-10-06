"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { Button as LegacyButton } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  EmptyState as LegacyEmpty,
  ErrorState,
  LoadingState,
} from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, ApiClientError } from "@/lib/api";
import { useFlag } from "@/lib/flags";
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  FilterChip,
  ListRow,
  Modal,
  SearchField,
  Sheet,
  Skeleton,
  amMedia,
  useAdminToast,
} from "@/components/admin-mobile";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  status: "planned" | "active" | "paused" | "retired";
  public_visibility: "internal" | "public";
  community_id: string | null;
  version: number;
  summary?: string | null;
};

type Project = { _id: string; name: string; slug: string };

export default function AdminBusinesses() {
  const mobile = useFlag("admin.mobileShell");
  return mobile ? <MobileBusinesses /> : <LegacyBusinesses />;
}

/* ================================================================= */
/* Mobile                                                             */
/* ================================================================= */

const STATUSES = ["planned", "active", "paused", "retired"] as const;
type Status = (typeof STATUSES)[number] | "all";

const KINDS = ["farming", "livestock", "poultry", "crafts", "retail", "services", "other"] as const;

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
  gap: 10px;
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

const List = styled(Card)`
  padding: 0;
  overflow: hidden;
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
  ${amMedia.lg} {
    display: none;
  }
`;

const DesktopNew = styled.div`
  display: none;
  ${amMedia.lg} {
    display: flex;
    justify-content: flex-end;
  }
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
  font: inherit;
  &:focus {
    outline: 2px solid var(--am-brand-500);
    outline-offset: 2px;
    border-color: var(--am-brand-500);
  }
`;

const Textarea = styled.textarea`
  min-height: 76px;
  padding: 10px 12px;
  border-radius: var(--am-radius-md);
  background: var(--am-surface);
  color: var(--am-ink);
  border: 1px solid var(--am-border-strong);
  font: inherit;
  resize: vertical;
`;

const Select = styled.select`
  min-height: 44px;
  padding: 0 12px;
  border-radius: var(--am-radius-md);
  background: var(--am-surface);
  color: var(--am-ink);
  border: 1px solid var(--am-border-strong);
  font: inherit;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
`;

const DetailBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const DetailSection = styled.div`
  background: var(--am-surface);
  padding: 12px;
  border-radius: var(--am-radius-md);
  border: 1px solid var(--am-border);
  h3 {
    margin: 0 0 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--am-ink-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  dl {
    margin: 0;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 10px;
    font-size: 14px;
    dt {
      color: var(--am-ink-muted);
    }
    dd {
      margin: 0;
    }
  }
`;

const Actions = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

function statusTone(s: Row["status"]): "success" | "warning" | "neutral" | "danger" {
  if (s === "active") return "success";
  if (s === "planned" || s === "paused") return "warning";
  if (s === "retired") return "danger";
  return "neutral";
}

function MobileBusinesses() {
  const toast = useAdminToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ slug: "", name: "", kind: "farming", summary: "" });
  const [detail, setDetail] = useState<Row | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkProject, setLinkProject] = useState("");
  const [confirmRetire, setConfirmRetire] = useState<Row | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const data = await api<Row[]>("/admin/businesses/");
      setRows(data);
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Could not load businesses.");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
    void api<{ items: Project[]; next_cursor: string | null }>("/projects?limit=200")
      .then((d) => setProjects(d.items))
      .catch(() => setProjects([]));
  }, [load]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q);
    });
  }, [rows, query, status]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: rows?.length ?? 0 };
    for (const s of STATUSES) m[s] = rows?.filter((r) => r.status === s).length ?? 0;
    return m;
  }, [rows]);

  async function create() {
    if (!form.slug || !form.name) return;
    setSubmitting(true);
    try {
      await api("/admin/businesses/", { json: form });
      toast.push({ tone: "success", message: "Business created." });
      setCreateOpen(false);
      setForm({ slug: "", name: "", kind: "farming", summary: "" });
      await load();
    } catch (e) {
      toast.push({
        tone: "danger",
        message: e instanceof ApiClientError ? e.message : "Create failed.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function approve(r: Row) {
    try {
      await api(`/admin/businesses/${r.id}/approve`, { json: {} });
      toast.push({ tone: "success", message: "Business is now public." });
      setDetail(null);
      await load();
    } catch (e) {
      toast.push({
        tone: "danger",
        message: e instanceof ApiClientError ? e.message : "Failed.",
      });
    }
  }

  async function retire(r: Row) {
    try {
      await api(`/admin/businesses/${r.id}/retire`, { json: {} });
      toast.push({ tone: "success", message: "Business retired." });
      setConfirmRetire(null);
      setDetail(null);
      await load();
    } catch (e) {
      toast.push({
        tone: "danger",
        message: e instanceof ApiClientError ? e.message : "Failed.",
      });
    }
  }

  async function link(r: Row) {
    if (!linkProject) return;
    try {
      await api(`/admin/businesses/${r.id}/link`, { json: { project_id: linkProject } });
      toast.push({ tone: "success", message: "Linked to project." });
      setLinkOpen(false);
      setLinkProject("");
    } catch (e) {
      toast.push({
        tone: "danger",
        message: e instanceof ApiClientError ? e.message : "Link failed.",
      });
    }
  }

  return (
    <Page>
      <PageTitle>Businesses</PageTitle>

      <Toolbar>
        <SearchField
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
          placeholder="Search businesses"
        />
        <Chips>
          <FilterChip active={status === "all"} onClick={() => setStatus("all")} count={counts.all}>
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
          <Button onClick={() => setCreateOpen(true)}>+ New business</Button>
        </DesktopNew>
      </Toolbar>

      {err && (
        <Banner
          tone="danger"
          title="Couldn't load businesses"
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
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ padding: 16, borderTop: i === 0 ? 0 : "1px solid var(--am-border)" }}>
              <Skeleton height={16} width="60%" />
              <div style={{ height: 6 }} />
              <Skeleton height={12} width="30%" />
            </div>
          ))}
        </List>
      ) : filtered && filtered.length === 0 ? (
        <Card padding="none">
          <EmptyState
            title={rows.length === 0 ? "No businesses yet" : "No matches"}
            description={
              rows.length === 0
                ? "Create a business for every revenue-generating activity."
                : "Try a different search or filter."
            }
            action={
              rows.length === 0 ? (
                <Button onClick={() => setCreateOpen(true)}>+ New business</Button>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setQuery("");
                    setStatus("all");
                  }}
                >
                  Clear filters
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <List>
          {filtered!.map((r) => (
            <ListRow
              key={r.id}
              leading={<Avatar name={r.name} size="md" />}
              title={r.name}
              meta={`${r.kind} · ${r.slug}`}
              onClick={() => setDetail(r)}
              trailing={
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                  {r.public_visibility === "public" ? (
                    <Badge tone="info">public</Badge>
                  ) : null}
                </div>
              }
            />
          ))}
        </List>
      )}

      <Fab type="button" aria-label="New business" onClick={() => setCreateOpen(true)}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </Fab>

      <Sheet
        open={createOpen}
        onClose={() => (submitting ? undefined : setCreateOpen(false))}
        title="New business"
        description="Create a business for every revenue-generating activity you want on the sustainability page."
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
              disabled={!form.slug || !form.name}
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
              placeholder="e.g. Sarah's Egg Farm"
              autoFocus
            />
          </Field>
          <Field>
            <span>Slug</span>
            <Input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="sarahs-egg-farm"
              pattern="[a-z0-9-]{1,120}"
              autoCapitalize="none"
              spellCheck={false}
            />
          </Field>
          <Field>
            <span>Kind</span>
            <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <span>Summary</span>
            <Textarea
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              maxLength={2000}
            />
          </Field>
        </FormGrid>
      </Sheet>

      {/* Detail sheet (full) */}
      <Sheet
        open={!!detail}
        onClose={() => setDetail(null)}
        variant="full"
        title={detail?.name ?? ""}
        description={detail ? `${detail.kind} · ${detail.slug}` : undefined}
      >
        {detail && (
          <DetailBody>
            <DetailSection>
              <h3>Identity</h3>
              <dl>
                <dt>Status</dt>
                <dd>
                  <Badge tone={statusTone(detail.status)}>{detail.status}</Badge>
                </dd>
                <dt>Visibility</dt>
                <dd>
                  <Badge tone={detail.public_visibility === "public" ? "success" : "neutral"}>
                    {detail.public_visibility}
                  </Badge>
                </dd>
                <dt>Kind</dt>
                <dd>{detail.kind}</dd>
                <dt>Slug</dt>
                <dd>{detail.slug}</dd>
              </dl>
            </DetailSection>
            {detail.summary ? (
              <DetailSection>
                <h3>Summary</h3>
                <p style={{ margin: 0 }}>{detail.summary}</p>
              </DetailSection>
            ) : null}
            <Actions>
              {detail.public_visibility === "internal" ? (
                <Button variant="primary" onClick={() => approve(detail)}>
                  Approve for public
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => setLinkOpen(true)}>
                Link to project
              </Button>
              {detail.status !== "retired" ? (
                <Button variant="danger" onClick={() => setConfirmRetire(detail)}>
                  Retire
                </Button>
              ) : null}
            </Actions>
          </DetailBody>
        )}
      </Sheet>

      {/* Link-to-project sheet */}
      <Sheet
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title="Link to project"
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setLinkOpen(false)}>
              Cancel
            </Button>
            <Button
              fullWidth
              onClick={() => detail && link(detail)}
              disabled={!linkProject}
            >
              Link
            </Button>
          </>
        }
      >
        <FormGrid>
          <Field>
            <span>Project</span>
            <Select value={linkProject} onChange={(e) => setLinkProject(e.target.value)}>
              <option value="">Pick a project…</option>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        </FormGrid>
      </Sheet>

      <ConfirmDialog
        open={!!confirmRetire}
        onCancel={() => setConfirmRetire(null)}
        onConfirm={() => confirmRetire && retire(confirmRetire)}
        title="Retire business?"
        description={
          confirmRetire
            ? `"${confirmRetire.name}" will be removed from the public site. Historical records remain.`
            : ""
        }
        confirmLabel="Retire"
        destructive
      />
    </Page>
  );
}

/* ================================================================= */
/* Legacy fallback                                                    */
/* ================================================================= */

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

const LegacyField = styled.label`
  display: grid;
  gap: 0.3rem;
  margin-bottom: 0.9rem;
  span {
    font-size: 0.82rem;
    font-weight: 600;
  }
  input,
  select,
  textarea {
    padding: 0.6rem 0.8rem;
    border-radius: ${({ theme }) => theme.radius.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    font: inherit;
  }
`;

function LegacyBusinesses() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    setErr(null);
    try {
      const data = await api<Row[]>("/admin/businesses/");
      setRows(data);
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Could not load businesses.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve(id: string) {
    try {
      await api(`/admin/businesses/${id}/approve`, { json: {} });
      toast.push({ tone: "success", message: "Business is now public." });
      await load();
    } catch (e) {
      toast.push({
        tone: "danger",
        message: e instanceof ApiClientError ? e.message : "Failed.",
      });
    }
  }

  async function retire(id: string) {
    try {
      await api(`/admin/businesses/${id}/retire`, { json: {} });
      toast.push({ tone: "success", message: "Business retired." });
      await load();
    } catch (e) {
      toast.push({
        tone: "danger",
        message: e instanceof ApiClientError ? e.message : "Failed.",
      });
    }
  }

  const columns: Column<Row>[] = [
    { key: "name", header: "Name", render: (r) => r.name },
    { key: "kind", header: "Kind", render: (r) => <StatusBadge tone="info">{r.kind}</StatusBadge> },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <StatusBadge
          tone={
            r.status === "active"
              ? "success"
              : r.status === "retired"
                ? "danger"
                : "warning"
          }
        >
          {r.status}
        </StatusBadge>
      ),
    },
    {
      key: "visibility",
      header: "Public",
      render: (r) => (
        <StatusBadge tone={r.public_visibility === "public" ? "success" : "neutral"}>
          {r.public_visibility}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <>
          {r.public_visibility === "internal" ? (
            <LegacyButton onClick={() => approve(r.id)} variant="secondary">
              Approve
            </LegacyButton>
          ) : null}
          {r.status !== "retired" ? (
            <LegacyButton onClick={() => retire(r.id)} variant="ghost">
              Retire
            </LegacyButton>
          ) : null}
        </>
      ),
    },
  ];

  return (
    <div>
      <LegacyHeader>
        <h2>Businesses</h2>
        <LegacyButton onClick={() => setOpen(true)}>New business</LegacyButton>
      </LegacyHeader>

      {err ? (
        <ErrorState message={err} retry={load} />
      ) : rows === null ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <LegacyEmpty title="No businesses yet" />
      ) : (
        <DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} />
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="New business">
        <LegacyCreateForm
          onDone={async () => {
            setOpen(false);
            await load();
            toast.push({ tone: "success", message: "Business created." });
          }}
        />
      </Dialog>
    </div>
  );
}

function LegacyCreateForm({ onDone }: { onDone: () => void }) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState("farming");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await api("/admin/businesses/", { json: { slug, name, kind, summary } });
      onDone();
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Could not create.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <LegacyField>
        <span>Slug</span>
        <input required value={slug} onChange={(e) => setSlug(e.target.value)} />
      </LegacyField>
      <LegacyField>
        <span>Name</span>
        <input required value={name} onChange={(e) => setName(e.target.value)} />
      </LegacyField>
      <LegacyField>
        <span>Kind</span>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </LegacyField>
      <LegacyField>
        <span>Summary</span>
        <textarea rows={3} maxLength={2000} value={summary} onChange={(e) => setSummary(e.target.value)} />
      </LegacyField>
      {err ? <p role="alert" style={{ color: "#b91c1c" }}>{err}</p> : null}
      <LegacyButton type="submit" loading={loading} full>
        {loading ? "Creating…" : "Create"}
      </LegacyButton>
    </form>
  );
}
