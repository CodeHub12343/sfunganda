"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { use } from "react";
import { api, ApiClientError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { LoadingState, ErrorState } from "@/components/ui/States";

export const dynamic = "force-dynamic";

type Doc = {
  _id: string;
  title: string;
  summary: string;
  body_markdown: string;
  state: string;
  version: number;
  occurred_on: string;
  location_label: string | null;
  beneficiary_count: number | null;
  created_by: string;
  reviewer_id: string | null;
  approved_by: string | null;
  public_id: string | null;
  media_asset_ids: string[];
};

type HistoryRow = {
  kind: string;
  from_state: string;
  to_state: string;
  by_user_id: string;
  note: string | null;
  created_at: string;
};

type Revision = {
  version: number;
  state_before: string;
  state_after: string;
  snapshot: Doc;
  by_user_id: string;
  created_at: string;
};

export default function ReviewScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const router = useRouter();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [sg, setSg] = useState({
    consent_recorded: false,
    no_minor_identifiers: false,
    images_appropriate: false,
    names_scrubbed: false,
  });
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [a, revs] = await Promise.all([
        api<{ doc: Doc; history: HistoryRow[] }>(`/accomplishments/${id}`),
        api<Revision[]>(`/accomplishments/${id}/revisions`),
      ]);
      setDoc(a.doc);
      setHistory(a.history);
      setRevisions(revs);
    } catch (e) {
      setErr((e as ApiClientError).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(transition: string, payload: Record<string, unknown> = {}) {
    if (!doc) return;
    try {
      await api(`/accomplishments/${id}/transition`, {
        json: { transition, version: doc.version, ...payload },
      });
      toast.show("Updated", "ok");
      await load();
    } catch (e) {
      toast.show((e as ApiClientError).message, "error");
    }
  }

  if (!doc && !err) return <LoadingState />;
  if (err) return <ErrorState message={err} onRetry={() => void load()} />;
  if (!doc) return null;

  const previous = revisions[1]?.snapshot ?? null;

  return (
    <section>
      <header style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>{doc.title}</h1>
          <small style={{ color: "#6b7280" }}>
            v{doc.version} · state: <strong>{doc.state}</strong>{" "}
            {doc.public_id ? `· ${doc.public_id}` : null}
          </small>
        </div>
        <Button variant="ghost" onClick={() => router.push("/admin/queue")}>
          Back
        </Button>
      </header>

      <section
        style={{
          marginTop: "1.5rem",
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: "1.5rem",
        }}
      >
        <article>
          <h2 style={{ fontSize: "1.1rem" }}>{doc.summary}</h2>
          <RevisionDiff before={previous?.body_markdown ?? ""} after={doc.body_markdown} />
          <dl style={{ marginTop: "1rem" }}>
            <dt>Occurred on</dt>
            <dd>{new Date(doc.occurred_on).toLocaleDateString()}</dd>
            <dt>Location</dt>
            <dd>{doc.location_label ?? "—"}</dd>
            <dt>Beneficiaries</dt>
            <dd>{doc.beneficiary_count ?? "—"}</dd>
            <dt>Media attached</dt>
            <dd>{doc.media_asset_ids.length}</dd>
          </dl>
        </article>

        <aside
          style={{
            border: "1px solid #e5e7eb",
            padding: "1rem 1.25rem",
            borderRadius: 10,
            background: "#fff",
            alignSelf: "start",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Approval panel</h3>
          <ActionsForState doc={doc} onAct={act} sg={sg} setSg={setSg} note={note} setNote={setNote} />

          <h3 style={{ marginTop: "1.5rem" }}>History</h3>
          <ol style={{ paddingLeft: "1.1rem", fontSize: "0.9rem" }}>
            {history.map((h, i) => (
              <li key={i} style={{ marginBottom: "0.4rem" }}>
                <strong>{h.kind.replace("_", " ")}</strong>{" "}
                <small style={{ color: "#6b7280" }}>
                  {h.from_state} → {h.to_state} · {new Date(h.created_at).toLocaleString()}
                </small>
                {h.note ? <div style={{ color: "#374151" }}>{h.note}</div> : null}
              </li>
            ))}
          </ol>
        </aside>
      </section>
    </section>
  );
}

function ActionsForState({
  doc,
  onAct,
  sg,
  setSg,
  note,
  setNote,
}: {
  doc: Doc;
  onAct: (t: string, p?: Record<string, unknown>) => Promise<void>;
  sg: Record<string, boolean>;
  setSg: (next: Record<string, boolean>) => void;
  note: string;
  setNote: (s: string) => void;
}) {
  const can = (states: string[]) => states.includes(doc.state);
  return (
    <>
      <label style={{ display: "block", margin: "0.5rem 0" }}>
        <span style={{ display: "block", fontSize: "0.85rem", color: "#6b7280" }}>Note</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          style={{ width: "100%", padding: "0.5rem", border: "1px solid #e5e7eb", borderRadius: 6 }}
        />
      </label>

      {can(["submitted"]) ? (
        <Button variant="primary" onClick={() => onAct("claim_review")}>
          Claim for review
        </Button>
      ) : null}

      {can(["in_review"]) ? (
        <>
          <fieldset style={{ margin: "1rem 0", border: "1px dashed #e5e7eb", padding: "0.75rem" }}>
            <legend>Safeguarding checklist</legend>
            {Object.entries(sg).map(([k, v]) => (
              <label key={k} style={{ display: "block", margin: "0.25rem 0" }}>
                <input
                  type="checkbox"
                  checked={v}
                  onChange={(e) => setSg({ ...sg, [k]: e.target.checked })}
                />{" "}
                {k.replace(/_/g, " ")}
              </label>
            ))}
          </fieldset>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <Button variant="primary" onClick={() => onAct("approve", { safeguarding: sg, note })}>
              Approve
            </Button>
            <Button variant="secondary" onClick={() => onAct("request_changes", { note })}>
              Request changes
            </Button>
            <Button variant="ghost" onClick={() => onAct("reject", { note })}>
              Reject
            </Button>
          </div>
        </>
      ) : null}

      {can(["approved"]) ? (
        <Button variant="primary" onClick={() => onAct("publish")}>
          Publish
        </Button>
      ) : null}

      {can(["draft", "changes_requested"]) ? (
        <Button variant="primary" onClick={() => onAct("submit", { note })}>
          Submit for review
        </Button>
      ) : null}
    </>
  );
}

function RevisionDiff({ before, after }: { before: string; after: string }) {
  if (!before) {
    return (
      <pre style={{ whiteSpace: "pre-wrap", background: "#f9fafb", padding: "1rem", borderRadius: 8 }}>
        {after}
      </pre>
    );
  }
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const max = Math.max(beforeLines.length, afterLines.length);
  const rows: Array<{ kind: "same" | "add" | "del"; text: string }> = [];
  for (let i = 0; i < max; i++) {
    const b = beforeLines[i];
    const a = afterLines[i];
    if (b === a) rows.push({ kind: "same", text: a ?? "" });
    else {
      if (b !== undefined) rows.push({ kind: "del", text: b });
      if (a !== undefined) rows.push({ kind: "add", text: a });
    }
  }
  return (
    <div style={{ background: "#f9fafb", padding: "1rem", borderRadius: 8, fontFamily: "monospace", fontSize: "0.85rem" }}>
      {rows.map((r, i) => (
        <div
          key={i}
          style={{
            background: r.kind === "add" ? "#d1fae5" : r.kind === "del" ? "#fee2e2" : "transparent",
            padding: "0 0.3rem",
            whiteSpace: "pre-wrap",
          }}
        >
          {r.kind === "add" ? "+ " : r.kind === "del" ? "- " : "  "}
          {r.text}
        </div>
      ))}
    </div>
  );
}
