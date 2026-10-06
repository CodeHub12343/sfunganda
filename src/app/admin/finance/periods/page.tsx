"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";

export const dynamic = "force-dynamic";

type Period = {
  _id: string;
  code: string;
  status: "open" | "pending_close" | "closed";
  starts_on: string;
  ends_on: string;
  reopened_count: number;
  version: number;
  closed_at: string | null;
  snapshot: {
    gross_received_cents: number;
    net_received_cents: number;
    expenses_cents: number;
    base_currency: string;
  } | null;
};

function money(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default function PeriodsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Period[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [newCode, setNewCode] = useState("");

  const load = useCallback(async () => {
    setErr(null);
    try {
      const data = await api<Period[]>("/finance/periods");
      setRows(data);
    } catch (e) {
      setErr((e as ApiClientError).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function openOne() {
    try {
      await api("/finance/periods", { json: { code: newCode } });
      setNewCode("");
      void load();
      toast.push({ message: "Period opened", tone: "success" });
    } catch (e) {
      toast.push({ message: (e as ApiClientError).message, tone: "danger" });
    }
  }

  async function setStatus(code: string, status: Period["status"], version: number) {
    try {
      await api(`/finance/periods/${code}/status`, {
        json: { status, version },
      });
      void load();
      toast.push({ message: "Updated", tone: "success" });
    } catch (e) {
      toast.push({ message: (e as ApiClientError).message, tone: "danger" });
    }
  }

  return (
    <section>
      <h1 style={{ fontSize: "1.5rem" }}>Accounting periods</h1>
      <p style={{ color: "#6b7280" }}>
        Closing a period locks it: postings and reversals that fall inside the dates are refused
        until it is reopened. The last snapshot is kept so a reopen+recompute can be compared.
      </p>

      <section style={card}>
        <h2 style={{ marginTop: 0 }}>Open a new period</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            placeholder="YYYY-MM (e.g. 2026-02)"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            style={{ padding: "0.5rem", border: "1px solid #e5e7eb", borderRadius: 6, flex: 1 }}
          />
          <Button onClick={openOne} disabled={!/^\d{4}-\d{2}$/.test(newCode)}>
            Open
          </Button>
        </div>
      </section>

      {err ? <ErrorState message={err} onRetry={() => void load()} /> : null}
      {rows === null ? <LoadingState /> : null}
      {rows ? (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.75rem", marginTop: "1.5rem" }}>
          {rows.map((p) => (
            <li key={p._id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{p.code}</h2>
                  <small style={{ color: "#6b7280" }}>
                    {new Date(p.starts_on).toLocaleDateString()} —{" "}
                    {new Date(new Date(p.ends_on).getTime() - 1).toLocaleDateString()}
                    {p.reopened_count > 0 ? ` · reopened ${p.reopened_count}×` : null}
                  </small>
                  {p.snapshot ? (
                    <div style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
                      Snapshot: gross {money(p.snapshot.gross_received_cents, p.snapshot.base_currency)} ·
                      net {money(p.snapshot.net_received_cents, p.snapshot.base_currency)} ·
                      expenses {money(p.snapshot.expenses_cents, p.snapshot.base_currency)}
                    </div>
                  ) : null}
                </div>
                <StatusBadge
                  status={p.status === "closed" ? "suspended" : p.status === "pending_close" ? "pending" : "active"}
                >
                  {p.status}
                </StatusBadge>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
                {p.status === "open" ? (
                  <Button variant="ghost" onClick={() => setStatus(p.code, "pending_close", p.version)}>
                    Begin close
                  </Button>
                ) : null}
                {p.status === "pending_close" ? (
                  <>
                    <Button onClick={() => setStatus(p.code, "closed", p.version)}>
                      Close
                    </Button>
                    <Button variant="ghost" onClick={() => setStatus(p.code, "open", p.version)}>
                      Reopen
                    </Button>
                  </>
                ) : null}
                {p.status === "closed" ? (
                  <Button variant="ghost" onClick={() => setStatus(p.code, "open", p.version)}>
                    Reopen (audit event)
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

const card: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: "1rem 1.25rem",
  background: "#fff",
  marginTop: "1rem",
};
