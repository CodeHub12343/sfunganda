"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ErrorState, LoadingState } from "@/components/ui/States";

export const dynamic = "force-dynamic";

type Line = {
  side: "debit" | "credit";
  fund_id: string;
  account: string;
  amount_cents: number;
  memo: string | null;
  project_id: string | null;
};

type Txn = {
  _id: string;
  public_id: string | null;
  kind: string;
  state: string;
  base_currency: string;
  base_amount_cents: number;
  source_currency: string;
  source_amount_cents: number;
  occurred_on: string;
  memo: string;
  lines: Line[];
  version: number;
  created_by: string;
  approved_by: string | null;
  posted_by: string | null;
};

type Entry = {
  seq: number;
  side: "debit" | "credit";
  account: string;
  amount_cents: number;
  hash: string;
  prev_hash: string;
  posted_at: string;
};

function money(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default function TxnDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const router = useRouter();
  const [doc, setDoc] = useState<Txn | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [stepup, setStepup] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api<{ doc: Txn; entries: Entry[] }>(`/finance/transactions/${id}`);
      setDoc(data.doc);
      setEntries(data.entries);
    } catch (e) {
      setErr((e as ApiClientError).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: string, needsStepup = false) {
    if (!doc) return;
    try {
      await api(`/finance/transactions/${id}/action`, {
        json: {
          action,
          version: doc.version,
          reason: reason || undefined,
          stepup_token: needsStepup ? stepup : undefined,
        },
      });
      toast.show("Updated", "ok");
      setReason("");
      void load();
    } catch (e) {
      toast.show((e as ApiClientError).message, "error");
    }
  }

  if (!doc && !err) return <LoadingState />;
  if (err) return <ErrorState message={err} onRetry={() => void load()} />;
  if (!doc) return null;

  return (
    <section style={{ display: "grid", gap: "1.5rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0 }}>{doc.public_id ?? doc._id.slice(0, 8)}</h1>
          <small style={{ color: "#6b7280" }}>
            {doc.kind} · v{doc.version} · {money(doc.base_amount_cents, doc.base_currency)}
            {doc.source_currency !== doc.base_currency
              ? ` (orig ${money(doc.source_amount_cents, doc.source_currency)})`
              : null}
          </small>
        </div>
        <StatusBadge status={doc.state === "posted" ? "active" : "pending"}>{doc.state}</StatusBadge>
      </header>

      <section style={card}>
        <h2 style={{ marginTop: 0 }}>Lines</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th>Side</th>
              <th>Account</th>
              <th style={{ textAlign: "right" }}>Amount</th>
              <th>Memo</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l, i) => (
              <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                <td>{l.side}</td>
                <td style={{ fontFamily: "monospace" }}>{l.account}</td>
                <td style={{ textAlign: "right" }}>
                  {money(l.amount_cents, doc.base_currency)}
                </td>
                <td>{l.memo ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {entries.length > 0 ? (
        <section style={card}>
          <h2 style={{ marginTop: 0 }}>Ledger entries</h2>
          <small style={{ color: "#6b7280" }}>Insert-only, hash chained.</small>
          <ol style={{ paddingLeft: "1rem", marginTop: "0.6rem", fontSize: "0.85rem" }}>
            {entries.map((e) => (
              <li key={e.seq} style={{ margin: "0.3rem 0" }}>
                <strong>#{e.seq}</strong> · {e.side} {e.account}{" "}
                <small style={{ color: "#6b7280" }}>
                  {money(e.amount_cents, doc.base_currency)} · {e.hash.slice(0, 12)}…
                </small>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section style={card}>
        <h2 style={{ marginTop: 0 }}>Actions</h2>
        <label>
          <span style={{ display: "block", fontSize: "0.85rem", color: "#6b7280" }}>Reason / memo</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ width: "100%", padding: "0.4rem", border: "1px solid #e5e7eb", borderRadius: 6 }}
          />
        </label>
        <label>
          <span style={{ display: "block", fontSize: "0.85rem", color: "#6b7280", marginTop: "0.5rem" }}>
            Step-up MFA token (approve / reverse)
          </span>
          <input
            value={stepup}
            onChange={(e) => setStepup(e.target.value)}
            placeholder="paste your MFA code"
            style={{ width: "100%", padding: "0.4rem", border: "1px solid #e5e7eb", borderRadius: 6 }}
          />
        </label>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
          {doc.state === "draft" && <Button onClick={() => act("submit")}>Submit</Button>}
          {doc.state === "submitted" && <Button onClick={() => act("approve", true)}>Approve</Button>}
          {doc.state === "approved" && <Button onClick={() => act("post")}>Post to ledger</Button>}
          {doc.state === "posted" && (
            <Button variant="ghost" onClick={() => act("reverse", true)}>
              Reverse
            </Button>
          )}
          {["draft", "submitted"].includes(doc.state) && (
            <Button variant="ghost" onClick={() => act("void")}>
              Void
            </Button>
          )}
          <Button variant="ghost" onClick={() => router.push("/admin/finance")}>
            Back
          </Button>
        </div>
      </section>
    </section>
  );
}

const card: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: "1rem 1.25rem",
  background: "#fff",
};
