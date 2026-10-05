"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";

export const dynamic = "force-dynamic";

type Txn = {
  _id: string;
  public_id: string | null;
  kind: string;
  state: string;
  base_currency: string;
  base_amount_cents: number;
  occurred_on: string;
  memo: string;
  created_at: string;
};
type Fund = {
  _id: string;
  code: string;
  name: string;
  kind: string;
  base_currency: string;
  balance_cents: number;
  total_in_cents: number;
  total_out_cents: number;
};

const STATES = ["draft", "submitted", "approved", "posted", "reversed", "void"];

function money(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default function FinanceDashboard() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [txns, setTxns] = useState<Txn[] | null>(null);
  const [state, setState] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const q = state ? `?state=${state}` : "";
      const [f, t] = await Promise.all([
        api<Fund[]>("/finance/funds"),
        api<{ items: Txn[]; next_cursor: string | null }>(`/finance/transactions${q}`),
      ]);
      setFunds(f);
      setTxns(t.items);
    } catch (e) {
      setErr((e as ApiClientError).message);
    }
  }, [state]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section>
      <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Finance</h1>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
          margin: "1.5rem 0",
        }}
      >
        {funds.map((f) => (
          <article key={f._id} style={card}>
            <strong>{f.name}</strong>
            <small style={{ color: "#6b7280", display: "block" }}>
              {f.code} · {f.kind}
            </small>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0.4rem 0 0.3rem" }}>
              {money(f.balance_cents, f.base_currency)}
            </div>
            <small style={{ color: "#6b7280" }}>
              in {money(f.total_in_cents, f.base_currency)} · out{" "}
              {money(f.total_out_cents, f.base_currency)}
            </small>
          </article>
        ))}
      </section>

      <h2 style={{ fontSize: "1.1rem" }}>Transactions</h2>
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <button
          onClick={() => setState("")}
          aria-pressed={state === ""}
          style={pill(state === "")}
        >
          all
        </button>
        {STATES.map((s) => (
          <button key={s} onClick={() => setState(s)} aria-pressed={state === s} style={pill(state === s)}>
            {s}
          </button>
        ))}
      </div>

      {err ? <ErrorState message={err} onRetry={() => void load()} /> : null}
      {txns === null ? <LoadingState /> : null}
      {txns && txns.length === 0 ? <EmptyState title="No transactions" /> : null}
      {txns && txns.length > 0 ? (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.5rem" }}>
          {txns.map((t) => (
            <li key={t._id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1rem" }}>
                    <Link href={`/admin/finance/transactions/${t._id}`}>
                      {t.public_id ?? t._id.slice(0, 8)} · {t.kind}
                    </Link>
                  </h3>
                  <small style={{ color: "#6b7280" }}>
                    {new Date(t.occurred_on).toLocaleDateString()} ·{" "}
                    {money(t.base_amount_cents, t.base_currency)}
                  </small>
                  {t.memo ? <p style={{ margin: "0.3rem 0 0" }}>{t.memo}</p> : null}
                </div>
                <StatusBadge status={t.state === "posted" ? "active" : "pending"}>
                  {t.state}
                </StatusBadge>
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
  padding: "0.9rem 1.2rem",
  background: "#fff",
};
function pill(active: boolean): React.CSSProperties {
  return {
    padding: "0.35rem 0.8rem",
    borderRadius: 999,
    border: active ? "2px solid #111827" : "1px solid #e5e7eb",
    background: active ? "#111827" : "#fff",
    color: active ? "#fff" : "#111827",
    cursor: "pointer",
  };
}
