"use client";

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api, ApiClientError } from "@/lib/api";

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

export default function AuditPage() {
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
    { key: "action", header: "Action", render: (r) => <StatusBadge tone="info">{r.action}</StatusBadge> },
    { key: "entity", header: "Entity", render: (r) => `${r.entity_type}${r.entity_id ? " · " + r.entity_id.slice(-6) : ""}` },
    { key: "actor", header: "Actor", render: (r) => (r.actor_id ? r.actor_id.slice(-6) : "—") },
    { key: "request_id", header: "Request", render: (r) => <code>{r.request_id.slice(-8) || "—"}</code> },
  ];

  return (
    <div>
      <Header>
        <h2>Audit log</h2>
      </Header>
      {err ? (
        <ErrorState message={err} retry={load} />
      ) : rows === null ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState title="No audit rows yet" description="Admin actions appear here as they happen." />
      ) : (
        <DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} />
      )}
    </div>
  );
}
