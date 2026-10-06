"use client";

import { use, useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { api, ApiClientError } from "@/lib/api";
import { Button as LegacyButton } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { useFlag } from "@/lib/flags";
import {
  Badge,
  Banner,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
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
  summary: string;
  description: string;
  status: string;
  progress_pct: number;
  milestone_counts: { total: number; complete: number; in_progress: number };
  community_id: string;
  version: number;
};

type Milestone = {
  _id: string;
  title: string;
  description: string;
  status: "planned" | "in_progress" | "complete" | "cancelled";
  due_on: string | null;
  weight: number;
  order: number;
  version: number;
};

const MILESTONE_STATES = ["planned", "in_progress", "complete", "cancelled"] as const;
const PROJECT_STATES = ["planning", "active", "paused", "completed", "archived"] as const;

function statusTone(s: string): "success" | "warning" | "neutral" | "info" {
  if (s === "active" || s === "complete") return "success";
  if (s === "planning" || s === "paused" || s === "in_progress") return "warning";
  if (s === "completed") return "info";
  return "neutral";
}

export default function AdminProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const mobile = useFlag("admin.mobileShell");
  return mobile ? <MobileDetail id={id} /> : <LegacyDetail id={id} />;
}

/* ---------------- Mobile ---------------- */

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: calc(80px + env(safe-area-inset-bottom));

  ${amMedia.lg} {
    padding-bottom: 0;
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: 24px;
    align-items: start;
  }
`;

const Main = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
`;

const Hero = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--am-ink);
  letter-spacing: -0.01em;
`;

const Sub = styled.div`
  font-size: 13px;
  color: var(--am-ink-muted);
`;

const StatusRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 4px;
`;

const Progress = styled.div<{ $pct: number }>`
  position: relative;
  height: 8px;
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

const KPIRow = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--am-ink-muted);
`;

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--am-ink);
`;

const Milestones = styled.div`
  display: flex;
  flex-direction: column;
`;

const MilestoneRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  & + & {
    border-top: 1px solid var(--am-border);
  }
`;

const MilestoneBody = styled.div`
  flex: 1 1 auto;
  min-width: 0;
`;

const MilestoneTitle = styled.div`
  font-size: 15px;
  font-weight: 600;
  color: var(--am-ink);
`;

const MilestoneMeta = styled.div`
  font-size: 12px;
  color: var(--am-ink-muted);
`;

const Select = styled.select`
  min-height: 36px;
  padding: 0 10px;
  border-radius: var(--am-radius-md);
  background: var(--am-surface);
  color: var(--am-ink);
  border: 1px solid var(--am-border-strong);
  font-family: inherit;
  font-size: 13px;
`;

const ActionBar = styled.div`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 64px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background: var(--am-surface);
  border-top: 1px solid var(--am-border);
  display: flex;
  gap: 8px;
  z-index: var(--am-z-sticky);
  ${amMedia.lg} {
    position: static;
    padding: 0;
    border-top: 0;
    background: transparent;
  }
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
  width: 100%;
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
  width: 100%;
  resize: vertical;
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--am-ink-muted);
`;

const ShareUrl = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const Code = styled.code`
  flex: 1 1 auto;
  padding: 8px 12px;
  border-radius: var(--am-radius-md);
  background: var(--am-bg-soft);
  border: 1px solid var(--am-border);
  font-family: ui-monospace, Menlo, monospace;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

function MobileDetail({ id }: { id: string }) {
  const toast = useAdminToast();
  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [newMilestone, setNewMilestone] = useState({ title: "", weight: 1, due_on: "" });
  const [editForm, setEditForm] = useState<{ summary: string; status: string }>({
    summary: "",
    status: "planning",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingAdd, setSavingAdd] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [p, m] = await Promise.all([
        api<Project>(`/projects/${id}`),
        api<Milestone[]>(`/projects/${id}/milestones`),
      ]);
      setProject(p);
      setMilestones(m);
      setEditForm({ summary: p.summary, status: p.status });
    } catch (e) {
      setErr((e as ApiClientError).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateMilestone(m: Milestone, patch: Partial<Milestone>) {
    // Optimistic update
    const prev = milestones;
    setMilestones((list) =>
      list.map((x) => (x._id === m._id ? { ...x, ...patch } : x))
    );
    try {
      await api(`/projects/milestones/${m._id}`, {
        method: "PATCH",
        json: { ...patch, version: m.version },
      });
      toast.push({ tone: "success", message: "Milestone saved" });
      void load();
    } catch (e) {
      setMilestones(prev); // rollback
      toast.push({ tone: "danger", message: (e as ApiClientError).message });
    }
  }

  async function addMilestone() {
    if (!project || !newMilestone.title) return;
    setSavingAdd(true);
    try {
      await api("/projects/milestones", {
        json: {
          project_id: project._id,
          title: newMilestone.title,
          weight: newMilestone.weight,
          due_on: newMilestone.due_on || undefined,
        },
      });
      toast.push({ tone: "success", message: "Milestone added" });
      setNewMilestone({ title: "", weight: 1, due_on: "" });
      setAddOpen(false);
      void load();
    } catch (e) {
      toast.push({ tone: "danger", message: (e as ApiClientError).message });
    } finally {
      setSavingAdd(false);
    }
  }

  async function saveEdit() {
    if (!project) return;
    setSavingEdit(true);
    try {
      await api(`/projects/${project._id}`, {
        method: "PATCH",
        json: {
          summary: editForm.summary,
          status: editForm.status,
          version: project.version,
        },
      });
      toast.push({ tone: "success", message: "Saved" });
      setEditOpen(false);
      void load();
    } catch (e) {
      toast.push({ tone: "danger", message: (e as ApiClientError).message });
    } finally {
      setSavingEdit(false);
    }
  }

  async function archive() {
    if (!project) return;
    try {
      await api(`/projects/${project._id}`, {
        method: "PATCH",
        json: { status: "archived", version: project.version },
      });
      toast.push({ tone: "success", message: "Project archived" });
      setArchiveOpen(false);
      void load();
    } catch (e) {
      toast.push({ tone: "danger", message: (e as ApiClientError).message });
    }
  }

  if (!project && !err) {
    return (
      <Page>
        <Main>
          <Skeleton height={28} width="60%" />
          <Skeleton height={14} width="40%" />
          <Card>
            <Skeleton height={60} />
          </Card>
          <Card>
            <Skeleton height={100} />
          </Card>
        </Main>
      </Page>
    );
  }
  if (err) {
    return (
      <Banner tone="danger" title="Couldn't load project" action={
        <Button variant="ghost" size="sm" onClick={() => void load()}>Retry</Button>
      }>
        {err}
      </Banner>
    );
  }
  if (!project) return null;

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/projects/${project.slug}`
      : `/projects/${project.slug}`;

  return (
    <>
      <Page>
        <Main>
          <Hero>
            <Title>{project.name}</Title>
            <Sub>
              {project.slug} · v{project.version}
            </Sub>
            <StatusRow>
              <Badge tone={statusTone(project.status)}>{project.status}</Badge>
            </StatusRow>
          </Hero>

          <Card>
            <KPIRow>
              <strong style={{ color: "var(--am-ink)" }}>Progress</strong>
              <span>
                {project.milestone_counts.complete}/{project.milestone_counts.total}{" "}
                milestones · {project.progress_pct}%
              </span>
            </KPIRow>
            <div style={{ height: 8 }} />
            <Progress $pct={project.progress_pct} />
          </Card>

          {project.summary && (
            <Card>
              <SectionTitle style={{ marginBottom: 8 }}>Summary</SectionTitle>
              <p style={{ margin: 0, color: "var(--am-ink-muted)", fontSize: 14, lineHeight: "20px" }}>
                {project.summary}
              </p>
            </Card>
          )}

          <Section>
            <SectionTitle>Milestones</SectionTitle>
            <Card padding="md">
              {milestones.length === 0 ? (
                <EmptyState
                  title="No milestones yet"
                  description="Break your project into trackable milestones."
                  action={<Button size="sm" onClick={() => setAddOpen(true)}>+ Add milestone</Button>}
                />
              ) : (
                <Milestones>
                  {milestones.map((m) => (
                    <MilestoneRow key={m._id}>
                      <MilestoneBody>
                        <MilestoneTitle>{m.title}</MilestoneTitle>
                        <MilestoneMeta>
                          w{m.weight}
                          {m.due_on ? ` · due ${new Date(m.due_on).toLocaleDateString()}` : ""}
                        </MilestoneMeta>
                      </MilestoneBody>
                      <Select
                        value={m.status}
                        onChange={(e) =>
                          updateMilestone(m, {
                            status: e.target.value as Milestone["status"],
                          })
                        }
                        aria-label={`${m.title} status`}
                      >
                        {MILESTONE_STATES.map((s) => (
                          <option key={s} value={s}>
                            {s.replace("_", " ")}
                          </option>
                        ))}
                      </Select>
                    </MilestoneRow>
                  ))}
                </Milestones>
              )}
            </Card>
          </Section>
        </Main>

        <ActionBar>
          <Button variant="secondary" fullWidth onClick={() => setEditOpen(true)}>
            Edit
          </Button>
          <Button fullWidth onClick={() => setAddOpen(true)}>
            + Milestone
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setShareOpen(true)}>
            Share
          </Button>
        </ActionBar>
      </Page>

      <Sheet
        open={editOpen}
        onClose={() => (savingEdit ? undefined : setEditOpen(false))}
        title="Edit project"
        dismissible={!savingEdit}
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setEditOpen(false)} disabled={savingEdit}>
              Cancel
            </Button>
            <Button fullWidth loading={savingEdit} onClick={saveEdit}>
              Save
            </Button>
          </>
        }
      >
        <Field>
          <span>Summary</span>
          <Textarea
            value={editForm.summary}
            onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
          />
        </Field>
        <div style={{ height: 12 }} />
        <Field>
          <span>Status</span>
          <Select
            value={editForm.status}
            onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
            style={{ minHeight: 44 }}
          >
            {PROJECT_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <div style={{ height: 24, borderTop: "1px solid var(--am-border)", marginTop: 20 }} />
        <Button
          variant="danger"
          fullWidth
          onClick={() => {
            setEditOpen(false);
            setArchiveOpen(true);
          }}
          disabled={project.status === "archived"}
        >
          Archive project
        </Button>
      </Sheet>

      <Sheet
        open={addOpen}
        onClose={() => (savingAdd ? undefined : setAddOpen(false))}
        title="Add milestone"
        dismissible={!savingAdd}
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setAddOpen(false)} disabled={savingAdd}>
              Cancel
            </Button>
            <Button
              fullWidth
              loading={savingAdd}
              onClick={addMilestone}
              disabled={!newMilestone.title}
            >
              Add
            </Button>
          </>
        }
      >
        <Field>
          <span>Title</span>
          <Input
            value={newMilestone.title}
            onChange={(e) => setNewMilestone({ ...newMilestone, title: e.target.value })}
            autoFocus
          />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <Field>
            <span>Weight</span>
            <Input
              type="number"
              min={1}
              max={100}
              value={newMilestone.weight}
              onChange={(e) =>
                setNewMilestone({ ...newMilestone, weight: Number(e.target.value) })
              }
            />
          </Field>
          <Field>
            <span>Due</span>
            <Input
              type="date"
              value={newMilestone.due_on}
              onChange={(e) => setNewMilestone({ ...newMilestone, due_on: e.target.value })}
            />
          </Field>
        </div>
      </Sheet>

      <Sheet open={shareOpen} onClose={() => setShareOpen(false)} title="Share project">
        <Field>
          <span>Public URL</span>
          <ShareUrl>
            <Code>{shareUrl}</Code>
            <Button
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareUrl);
                  toast.push({ tone: "success", message: "Link copied" });
                } catch {
                  toast.push({ tone: "danger", message: "Couldn't copy — select manually" });
                }
              }}
            >
              Copy
            </Button>
          </ShareUrl>
        </Field>
        <p
          style={{
            fontSize: 13,
            color: "var(--am-ink-muted)",
            marginTop: 12,
            lineHeight: "20px",
          }}
        >
          Only approved and active projects appear on the public portal.
        </p>
      </Sheet>

      <ConfirmDialog
        open={archiveOpen}
        title={`Archive "${project.name}"?`}
        description="Archived projects stop appearing in the public portal but remain in the ledger."
        confirmLabel="Archive"
        destructive
        onCancel={() => setArchiveOpen(false)}
        onConfirm={archive}
      />
    </>
  );
}

/* ---------------- Legacy (preserved) ---------------- */

function LegacyDetail({ id }: { id: string }) {
  const toast = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [newMilestone, setNewMilestone] = useState({ title: "", weight: 1, due_on: "" });

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [p, m] = await Promise.all([
        api<Project>(`/projects/${id}`),
        api<Milestone[]>(`/projects/${id}/milestones`),
      ]);
      setProject(p);
      setMilestones(m);
    } catch (e) {
      setErr((e as ApiClientError).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateMilestone(m: Milestone, patch: Partial<Milestone>) {
    try {
      await api(`/projects/milestones/${m._id}`, {
        method: "PATCH",
        json: { ...patch, version: m.version },
      });
      toast.push({ tone: "success", message: "Saved" });
      void load();
    } catch (e) {
      toast.push({ tone: "danger", message: (e as ApiClientError).message });
    }
  }

  async function addMilestone() {
    if (!project) return;
    try {
      await api("/projects/milestones", {
        json: {
          project_id: project._id,
          title: newMilestone.title,
          weight: newMilestone.weight,
          due_on: newMilestone.due_on || undefined,
        },
      });
      toast.push({ tone: "success", message: "Milestone added" });
      setNewMilestone({ title: "", weight: 1, due_on: "" });
      void load();
    } catch (e) {
      toast.push({ tone: "danger", message: (e as ApiClientError).message });
    }
  }

  async function updateProjectField(patch: Partial<Project>) {
    if (!project) return;
    try {
      await api(`/projects/${project._id}`, {
        method: "PATCH",
        json: { ...patch, version: project.version },
      });
      toast.push({ tone: "success", message: "Saved" });
      void load();
    } catch (e) {
      toast.push({ tone: "danger", message: (e as ApiClientError).message });
    }
  }

  if (!project && !err) return <LoadingState />;
  if (err) return <ErrorState message={err} onRetry={() => void load()} />;
  if (!project) return null;

  return (
    <section style={{ display: "grid", gap: "1.5rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0 }}>{project.name}</h1>
          <small style={{ color: "#6b7280" }}>
            {project.slug} · v{project.version}
          </small>
        </div>
        <StatusBadge tone={project.status === "active" ? "success" : "warning"}>
          {project.status}
        </StatusBadge>
      </header>

      <section style={legacyCard}>
        <h2 style={{ marginTop: 0 }}>Summary</h2>
        <textarea
          value={project.summary}
          onChange={(e) => setProject({ ...project, summary: e.target.value })}
          rows={3}
          style={legacyInput}
        />
        <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem" }}>
          <LegacyButton onClick={() => updateProjectField({ summary: project.summary })}>
            Save summary
          </LegacyButton>
          <select
            value={project.status}
            onChange={(e) => updateProjectField({ status: e.target.value })}
            style={legacyInput}
          >
            {PROJECT_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section style={legacyCard}>
        <h2 style={{ marginTop: 0 }}>
          Milestones ({project.milestone_counts.complete}/{project.milestone_counts.total} ·{" "}
          {project.progress_pct}%)
        </h2>
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.6rem" }}>
          {milestones.map((m) => (
            <li
              key={m._id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: "0.75rem 1rem",
                display: "flex",
                gap: "0.5rem",
                alignItems: "center",
              }}
            >
              <strong style={{ flex: 1 }}>{m.title}</strong>
              <select
                value={m.status}
                onChange={(e) =>
                  updateMilestone(m, { status: e.target.value as Milestone["status"] })
                }
                style={legacyInput}
              >
                {MILESTONE_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <small style={{ color: "#6b7280" }}>w{m.weight}</small>
            </li>
          ))}
        </ul>

        <div
          style={{
            display: "grid",
            gap: "0.5rem",
            gridTemplateColumns: "2fr 1fr 1fr auto",
            marginTop: "1rem",
          }}
        >
          <input
            placeholder="New milestone title"
            value={newMilestone.title}
            onChange={(e) => setNewMilestone({ ...newMilestone, title: e.target.value })}
            style={legacyInput}
          />
          <input
            type="number"
            min={1}
            max={100}
            value={newMilestone.weight}
            onChange={(e) => setNewMilestone({ ...newMilestone, weight: Number(e.target.value) })}
            style={legacyInput}
          />
          <input
            type="date"
            value={newMilestone.due_on}
            onChange={(e) => setNewMilestone({ ...newMilestone, due_on: e.target.value })}
            style={legacyInput}
          />
          <LegacyButton onClick={addMilestone} disabled={!newMilestone.title}>
            Add
          </LegacyButton>
        </div>
      </section>
    </section>
  );
}

const legacyCard: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: "1rem 1.25rem",
  background: "#fff",
};
const legacyInput: React.CSSProperties = {
  padding: "0.5rem",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  width: "100%",
};
