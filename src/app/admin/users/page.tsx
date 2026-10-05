"use client";

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, ApiClientError } from "@/lib/api";

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

const Header = styled.div`
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

const Field = styled.label`
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

function toneForStatus(s: Row["status"]) {
  if (s === "active") return "success" as const;
  if (s === "pending") return "info" as const;
  return "danger" as const;
}

export default function UsersPage() {
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
        r.assignments.length === 0 ? "—" : r.assignments.map((a) => `${a.role} (${a.scope_type})`).join(", "),
    },
    {
      key: "mfa",
      header: "MFA",
      render: (r) => (r.mfa_enrolled_at ? "Enrolled" : "—"),
    },
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
          <Button onClick={() => reinstate(r.id)} variant="secondary">
            Reinstate
          </Button>
        ) : (
          <Button onClick={() => suspend(r.id)} variant="ghost">
            Suspend
          </Button>
        ),
    },
  ];

  return (
    <div>
      <Header>
        <h2>Users &amp; roles</h2>
        <Button onClick={() => setOpen(true)}>Invite a user</Button>
      </Header>

      {err ? (
        <ErrorState message={err} retry={load} />
      ) : rows === null ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState title="No users yet" description="Invite your first teammate to get started." />
      ) : (
        <DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} />
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Invite a user">
        <InviteForm
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

function InviteForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("field_member");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await api("/admin/users/invite", {
        json: { email, display_name: name, role, scope_type: "organization", scope_id: null },
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
      <Field>
        <span>Email</span>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field>
        <span>Display name</span>
        <input required value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field>
        <span>Role</span>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="founder">founder</option>
          <option value="director">director</option>
          <option value="project_manager">project_manager</option>
          <option value="finance_manager">finance_manager</option>
          <option value="media_manager">media_manager</option>
          <option value="field_member">field_member</option>
          <option value="supporter">supporter</option>
        </select>
      </Field>
      {err ? (
        <p role="alert" style={{ color: "#b91c1c", margin: "0 0 0.75rem" }}>
          {err}
        </p>
      ) : null}
      <Button type="submit" loading={loading} full>
        {loading ? "Sending invitation…" : "Send invitation"}
      </Button>
    </form>
  );
}
