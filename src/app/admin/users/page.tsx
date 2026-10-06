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
  SearchField,
  Sheet,
  Skeleton,
  amMedia,
  useAdminToast,
} from "@/components/admin-mobile";

export const dynamic = "force-dynamic";

type Assignment = { id: string; role: string; scope_type: string; scope_id: string | null };
type Row = {
  id: string;
  email: string;
  display_name: string;
  status: "pending" | "active" | "suspended";
  mfa_enrolled_at: string | null;
  last_login_at: string | null;
  assignments: Assignment[];
};

const ROLE_OPTIONS = [
  "founder",
  "director",
  "project_manager",
  "finance_manager",
  "media_manager",
  "field_member",
  "supporter",
] as const;

type Role = (typeof ROLE_OPTIONS)[number];

function toneForStatus(s: Row["status"]): "success" | "info" | "danger" {
  if (s === "active") return "success";
  if (s === "pending") return "info";
  return "danger";
}

function badgeTone(s: Row["status"]): "success" | "warning" | "danger" {
  if (s === "active") return "success";
  if (s === "pending") return "warning";
  return "danger";
}

function firstLetter(s: string): string {
  return (s.trim()[0] ?? "#").toUpperCase();
}

export default function UsersPage() {
  const mobile = useFlag("admin.mobileShell");
  return mobile ? <MobileUsers /> : <LegacyUsers />;
}

/* ---------------- Mobile ---------------- */

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Head = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
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

const Group = styled.section`
  display: flex;
  flex-direction: column;
`;

const GroupHeader = styled.div`
  padding: 10px 12px 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--am-ink-subtle);
  background: var(--am-bg-soft);
  border-top: 1px solid var(--am-border);
  position: sticky;
  top: 56px;
  z-index: 1;
`;

const List = styled.div`
  background: var(--am-surface);
  border-radius: var(--am-radius-lg);
  overflow: hidden;
  box-shadow: var(--am-shadow-1);
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

const StepTrail = styled.ol`
  display: flex;
  gap: 8px;
  list-style: none;
  margin: 0 0 16px;
  padding: 0;
`;

const StepPill = styled.li<{ $active: boolean; $done: boolean }>`
  flex: 1 1 0;
  text-align: center;
  padding: 6px 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-radius: var(--am-radius-pill);
  background: ${({ $active, $done }) =>
    $active ? "var(--am-brand-600)" : $done ? "var(--am-success-600)" : "var(--am-bg-soft)"};
  color: ${({ $active, $done }) =>
    $active || $done ? "#fff" : "var(--am-ink-muted)"};
`;

const Err = styled.p`
  margin: 0;
  color: var(--am-danger-600);
  font-size: 13px;
`;

type InviteForm = {
  email: string;
  display_name: string;
  role: Role;
};

function MobileUsers() {
  const toast = useAdminToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | Row["status"]>("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [userSheet, setUserSheet] = useState<Row | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<Row | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const data = await api<Row[]>("/admin/users/");
      setRows(data);
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Could not load users.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => (status === "all" ? true : r.status === status))
      .filter((r) => {
        if (!q) return true;
        return (
          r.display_name.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.assignments.some((a) => a.role.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => a.display_name.localeCompare(b.display_name));
  }, [rows, query, status]);

  const grouped = useMemo(() => {
    if (!filtered) return [];
    const map = new Map<string, Row[]>();
    for (const r of filtered) {
      const letter = firstLetter(r.display_name);
      const bucket = map.get(letter) ?? [];
      bucket.push(r);
      map.set(letter, bucket);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const counts = useMemo(() => {
    if (!rows) return { all: 0, pending: 0, active: 0, suspended: 0 };
    return {
      all: rows.length,
      pending: rows.filter((r) => r.status === "pending").length,
      active: rows.filter((r) => r.status === "active").length,
      suspended: rows.filter((r) => r.status === "suspended").length,
    };
  }, [rows]);

  async function suspend(id: string) {
    setActing(true);
    try {
      await api(`/admin/users/${id}/suspend`, { json: {} });
      toast.push({ tone: "success", message: "User suspended." });
      setSuspendTarget(null);
      setUserSheet(null);
      await load();
    } catch (e) {
      toast.push({
        tone: "danger",
        message: e instanceof ApiClientError ? e.message : "Failed.",
      });
    } finally {
      setActing(false);
    }
  }

  async function reinstate(id: string) {
    setActing(true);
    try {
      await api(`/admin/users/${id}/reinstate`, { json: {} });
      toast.push({ tone: "success", message: "User reinstated." });
      setUserSheet(null);
      await load();
    } catch (e) {
      toast.push({
        tone: "danger",
        message: e instanceof ApiClientError ? e.message : "Failed.",
      });
    } finally {
      setActing(false);
    }
  }

  return (
    <Page>
      <Head>
        <Title>Users</Title>
      </Head>

      <SearchField
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onClear={() => setQuery("")}
        placeholder="Search by name, email, or role"
      />

      <Chips>
        <FilterChip
          active={status === "all"}
          onClick={() => setStatus("all")}
          count={counts.all}
        >
          All
        </FilterChip>
        <FilterChip
          active={status === "active"}
          onClick={() => setStatus("active")}
          count={counts.active}
        >
          Active
        </FilterChip>
        <FilterChip
          active={status === "pending"}
          onClick={() => setStatus("pending")}
          count={counts.pending}
        >
          Pending
        </FilterChip>
        <FilterChip
          active={status === "suspended"}
          onClick={() => setStatus("suspended")}
          count={counts.suspended}
        >
          Suspended
        </FilterChip>
      </Chips>

      {err && (
        <Banner tone="danger" title="Couldn't load users" action={
          <Button variant="ghost" size="sm" onClick={() => void load()}>Retry</Button>
        }>
          {err}
        </Banner>
      )}

      {rows === null ? (
        <List>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ padding: 16, borderBottom: "1px solid var(--am-border)" }}>
              <Skeleton height={16} width="60%" />
              <div style={{ height: 6 }} />
              <Skeleton height={12} width="40%" />
            </div>
          ))}
        </List>
      ) : filtered && filtered.length === 0 ? (
        <Card padding="none">
          <EmptyState
            title={rows.length === 0 ? "No users yet" : "No matches"}
            description={
              rows.length === 0
                ? "Invite your first teammate to get started."
                : "Try a different search or filter."
            }
            action={
              rows.length === 0 ? (
                <Button onClick={() => setInviteOpen(true)}>Invite a user</Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        grouped.map(([letter, items]) => (
          <Group key={letter}>
            <GroupHeader>{letter}</GroupHeader>
            <List>
              {items.map((u) => (
                <ListRow
                  key={u.id}
                  leading={<Avatar name={u.display_name} />}
                  title={u.display_name}
                  meta={`${u.email}${u.assignments.length > 0 ? ` · ${u.assignments.map((a) => a.role).join(", ")}` : ""}`}
                  trailing={<Badge tone={badgeTone(u.status)}>{u.status}</Badge>}
                  onClick={() => setUserSheet(u)}
                />
              ))}
            </List>
          </Group>
        ))
      )}

      <Fab type="button" aria-label="Invite a user" onClick={() => setInviteOpen(true)}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </Fab>

      <InviteSheet
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSuccess={() => {
          setInviteOpen(false);
          toast.push({ tone: "success", message: "Invitation sent." });
          void load();
        }}
      />

      <Sheet
        open={Boolean(userSheet)}
        onClose={() => setUserSheet(null)}
        title={userSheet?.display_name ?? "User"}
        footer={
          userSheet ? (
            userSheet.status === "suspended" ? (
              <Button
                fullWidth
                loading={acting}
                onClick={() => reinstate(userSheet.id)}
              >
                Reinstate
              </Button>
            ) : (
              <Button
                variant="danger"
                fullWidth
                disabled={acting}
                onClick={() => setSuspendTarget(userSheet)}
              >
                Suspend
              </Button>
            )
          ) : null
        }
      >
        {userSheet && (
          <>
            <Field style={{ marginBottom: 8 }}>
              <span>Email</span>
              <div style={{ color: "var(--am-ink)", fontWeight: 500 }}>{userSheet.email}</div>
            </Field>
            <Field style={{ marginBottom: 8 }}>
              <span>Status</span>
              <div>
                <Badge tone={badgeTone(userSheet.status)}>{userSheet.status}</Badge>
              </div>
            </Field>
            <Field style={{ marginBottom: 8 }}>
              <span>MFA</span>
              <div style={{ color: "var(--am-ink)" }}>
                {userSheet.mfa_enrolled_at
                  ? `Enrolled · ${new Date(userSheet.mfa_enrolled_at).toLocaleDateString()}`
                  : "Not enrolled"}
              </div>
            </Field>
            <Field style={{ marginBottom: 8 }}>
              <span>Last login</span>
              <div style={{ color: "var(--am-ink)" }}>
                {userSheet.last_login_at
                  ? new Date(userSheet.last_login_at).toLocaleString()
                  : "Never"}
              </div>
            </Field>
            <Field>
              <span>Roles</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {userSheet.assignments.length === 0 ? (
                  <span style={{ color: "var(--am-ink-muted)" }}>None</span>
                ) : (
                  userSheet.assignments.map((a) => (
                    <Badge key={a.id} tone="brand">
                      {a.role} · {a.scope_type}
                    </Badge>
                  ))
                )}
              </div>
            </Field>
          </>
        )}
      </Sheet>

      <ConfirmDialog
        open={Boolean(suspendTarget)}
        title={`Suspend ${suspendTarget?.display_name ?? "this user"}?`}
        description="They won't be able to sign in until reinstated. All their current sessions will be revoked."
        confirmLabel="Suspend"
        destructive
        loading={acting}
        onCancel={() => setSuspendTarget(null)}
        onConfirm={() => suspendTarget && suspend(suspendTarget.id)}
      />
    </Page>
  );
}

/* -------- Multi-step invite sheet -------- */

function InviteSheet({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<InviteForm>({
    email: "",
    display_name: "",
    role: "field_member",
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Reset when closed.
  useEffect(() => {
    if (!open) {
      setStep(1);
      setErr(null);
      setTouched({});
    }
  }, [open]);

  const emailValid = /^\S+@\S+\.\S+$/.test(form.email);
  const nameValid = form.display_name.trim().length >= 2;
  const step1Valid = emailValid && nameValid;

  function next() {
    setTouched({ email: true, display_name: true });
    if (step === 1 && !step1Valid) return;
    setStep((s) => (s === 1 ? 2 : s === 2 ? 3 : s));
  }

  function back() {
    setStep((s) => (s === 3 ? 2 : s === 2 ? 1 : s));
  }

  async function submit() {
    setErr(null);
    setSubmitting(true);
    try {
      await api("/admin/users/invite", {
        json: {
          email: form.email,
          display_name: form.display_name,
          role: form.role,
          scope_type: "organization",
          scope_id: null,
        },
      });
      onSuccess();
      setForm({ email: "", display_name: "", role: "field_member" });
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Could not invite.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={() => (submitting ? undefined : onClose())}
      title="Invite a user"
      description={
        step === 1
          ? "Identity"
          : step === 2
            ? "Role & permissions"
            : "Review"
      }
      dismissible={!submitting}
      footer={
        <>
          {step > 1 && (
            <Button variant="secondary" onClick={back} disabled={submitting}>
              Back
            </Button>
          )}
          {step < 3 ? (
            <Button
              fullWidth
              onClick={next}
              disabled={step === 1 && !step1Valid}
            >
              Next
            </Button>
          ) : (
            <Button fullWidth loading={submitting} onClick={submit}>
              Send invitation
            </Button>
          )}
        </>
      }
    >
      <StepTrail>
        <StepPill $active={step === 1} $done={step > 1}>
          1 · Identity
        </StepPill>
        <StepPill $active={step === 2} $done={step > 2}>
          2 · Role
        </StepPill>
        <StepPill $active={step === 3} $done={false}>
          3 · Review
        </StepPill>
      </StepTrail>

      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field>
            <span>Email</span>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              onBlur={() => setTouched({ ...touched, email: true })}
              inputMode="email"
              autoComplete="email"
              placeholder="name@domain.org"
              aria-invalid={touched.email && !emailValid}
              autoFocus
            />
            {touched.email && !emailValid && <Err>Enter a valid email address.</Err>}
          </Field>
          <Field>
            <span>Display name</span>
            <Input
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              onBlur={() => setTouched({ ...touched, display_name: true })}
              aria-invalid={touched.display_name && !nameValid}
              placeholder="e.g. Sarah Mendez"
            />
            {touched.display_name && !nameValid && <Err>At least 2 characters.</Err>}
          </Field>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field>
            <span>Role</span>
            <Select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
          <Banner tone="info" title="Scope: organisation">
            This role will apply across the whole organisation. Project-level
            scoping is available after they accept.
          </Banner>
        </div>
      )}

      {step === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Review label="Email" value={form.email} />
          <Review label="Display name" value={form.display_name} />
          <Review label="Role" value={form.role} />
          <Review label="Scope" value="organisation" />
          {err && (
            <Banner tone="danger" title="Couldn't send invitation">
              {err}
            </Banner>
          )}
        </div>
      )}
    </Sheet>
  );
}

const ReviewRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  background: var(--am-bg-soft);
  border-radius: var(--am-radius-md);
  font-size: 14px;
`;

const ReviewLabel = styled.span`
  color: var(--am-ink-muted);
`;

const ReviewValue = styled.span`
  color: var(--am-ink);
  font-weight: 600;
`;

function Review({ label, value }: { label: string; value: string }) {
  return (
    <ReviewRow>
      <ReviewLabel>{label}</ReviewLabel>
      <ReviewValue>{value}</ReviewValue>
    </ReviewRow>
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

const LegacyField = styled.label`
  display: grid;
  gap: 0.3rem;
  margin-bottom: 0.9rem;
  span {
    font-size: 0.82rem;
    font-weight: 600;
  }
  input,
  select {
    padding: 0.6rem 0.8rem;
    border-radius: ${({ theme }) => theme.radius.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    font: inherit;
  }
`;

function LegacyUsers() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    setErr(null);
    try {
      const data = await api<Row[]>("/admin/users/");
      setRows(data);
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Could not load users.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function suspend(id: string) {
    try {
      await api(`/admin/users/${id}/suspend`, { json: {} });
      toast.push({ tone: "success", message: "User suspended." });
      await load();
    } catch (e) {
      toast.push({ tone: "danger", message: e instanceof ApiClientError ? e.message : "Failed." });
    }
  }

  async function reinstate(id: string) {
    try {
      await api(`/admin/users/${id}/reinstate`, { json: {} });
      toast.push({ tone: "success", message: "User reinstated." });
      await load();
    } catch (e) {
      toast.push({ tone: "danger", message: e instanceof ApiClientError ? e.message : "Failed." });
    }
  }

  const columns: Column<Row>[] = [
    { key: "name", header: "Name", render: (r) => r.display_name },
    { key: "email", header: "Email", render: (r) => r.email },
    {
      key: "roles",
      header: "Roles",
      render: (r) =>
        r.assignments.length === 0
          ? "—"
          : r.assignments.map((a) => `${a.role} (${a.scope_type})`).join(", "),
    },
    { key: "mfa", header: "MFA", render: (r) => (r.mfa_enrolled_at ? "Enrolled" : "—") },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge tone={toneForStatus(r.status)}>{r.status}</StatusBadge>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) =>
        r.status === "suspended" ? (
          <LegacyButton onClick={() => reinstate(r.id)} variant="secondary">
            Reinstate
          </LegacyButton>
        ) : (
          <LegacyButton onClick={() => suspend(r.id)} variant="ghost">
            Suspend
          </LegacyButton>
        ),
    },
  ];

  return (
    <div>
      <LegacyHeader>
        <h2>Users &amp; roles</h2>
        <LegacyButton onClick={() => setOpen(true)}>Invite a user</LegacyButton>
      </LegacyHeader>

      {err ? (
        <ErrorState message={err} retry={load} />
      ) : rows === null ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <LegacyEmpty title="No users yet" description="Invite your first teammate to get started." />
      ) : (
        <DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} />
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Invite a user">
        <LegacyInviteForm
          onDone={async () => {
            setOpen(false);
            await load();
            toast.push({ tone: "success", message: "Invitation sent." });
          }}
        />
      </Dialog>
    </div>
  );
}

function LegacyInviteForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("field_member");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await api("/admin/users/invite", {
        json: {
          email,
          display_name: name,
          role,
          scope_type: "organization",
          scope_id: null,
        },
      });
      onDone();
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Could not invite.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <LegacyField>
        <span>Email</span>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </LegacyField>
      <LegacyField>
        <span>Display name</span>
        <input required value={name} onChange={(e) => setName(e.target.value)} />
      </LegacyField>
      <LegacyField>
        <span>Role</span>
        <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </LegacyField>
      {err ? (
        <p role="alert" style={{ color: "#b91c1c", margin: "0 0 0.75rem" }}>
          {err}
        </p>
      ) : null}
      <LegacyButton type="submit" loading={loading} full>
        {loading ? "Sending invitation…" : "Send invitation"}
      </LegacyButton>
    </form>
  );
}
