"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { api, ApiClientError } from "@/lib/api";
import { Badge, Banner, Button, Card, Skeleton } from "@/components/admin-mobile";

export const dynamic = "force-dynamic";

type Doc = {
  _id: string;
  public_id: string | null;
  title: string;
  summary: string;
  body_markdown: string;
  state: string;
  version: number;
  occurred_on: string;
  location_label: string | null;
  beneficiary_count: number | null;
  published_at: string | null;
  project_id: string;
  created_at: string;
};

type HistoryEvent = {
  _id: string;
  kind: string;
  from_state: string;
  to_state: string;
  note: string | null;
  created_at: string;
  actor_id: string;
};

type Transition = {
  name: string;
  label: string;
  variant: "primary" | "ghost" | "danger";
  requiresNote?: boolean;
};

const TRANSITIONS: Record<string, Transition[]> = {
  draft: [{ name: "submit", label: "Submit for review", variant: "primary" }],
  changes_requested: [
    { name: "submit", label: "Resubmit for review", variant: "primary" },
  ],
  submitted: [
    { name: "claim_review", label: "Claim for review", variant: "primary" },
    { name: "withdraw", label: "Withdraw", variant: "ghost" },
  ],
  in_review: [
    { name: "approve", label: "Approve", variant: "primary" },
    { name: "request_changes", label: "Request changes", variant: "ghost", requiresNote: true },
    { name: "reject", label: "Reject", variant: "danger", requiresNote: true },
    { name: "withdraw", label: "Withdraw", variant: "ghost" },
  ],
  approved: [
    { name: "publish", label: "Publish", variant: "primary" },
  ],
  published: [{ name: "archive", label: "Archive", variant: "ghost" }],
  rejected: [{ name: "archive", label: "Archive", variant: "ghost" }],
  archived: [],
};

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 820px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--am-ink);
`;

const Meta = styled.div`
  color: var(--am-ink-muted);
  font-size: 13px;
`;

const Body = styled.pre`
  white-space: pre-wrap;
  font-family: inherit;
  font-size: 15px;
  line-height: 1.55;
  margin: 0;
  color: var(--am-ink);
`;

const Row = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const History = styled.ol`
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const HistoryItem = styled.li`
  padding: 10px 12px;
  border: 1px solid var(--am-border);
  border-radius: var(--am-radius-md);
  font-size: 13px;
  color: var(--am-ink);
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

function stateTone(s: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (s === "published" || s === "approved") return "success";
  if (s === "submitted" || s === "in_review" || s === "changes_requested") return "warning";
  if (s === "rejected") return "danger";
  if (s === "draft") return "info";
  return "neutral";
}

export default function AdminAccomplishmentDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const data = await api<{ doc: Doc; history: HistoryEvent[] }>(
        `/accomplishments/${id}`
      );
      setDoc(data.doc);
      setHistory(data.history ?? []);
    } catch (e) {
      setErr((e as ApiClientError).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(t: Transition) {
    if (!doc) return;
    let note: string | undefined;
    if (t.requiresNote) {
      const entered = window.prompt(`Note for ${t.label.toLowerCase()}:`);
      if (entered === null) return;
      note = entered.trim() || undefined;
      if (t.name === "reject" && !note) {
        setErr("A reason is required when rejecting.");
        return;
      }
    } else if (t.name === "archive" || t.name === "publish") {
      if (!window.confirm(`${t.label} this accomplishment?`)) return;
    }
    setErr(null);
    setInfo(null);
    setBusy(t.name);
    try {
      await api(`/accomplishments/${doc._id}/transition`, {
        json: { transition: t.name, version: doc.version, note },
      });
      setInfo(`${t.label} succeeded.`);
      await load();
    } catch (e) {
      setErr((e as ApiClientError).message);
    } finally {
      setBusy(null);
    }
  }

  if (!doc) {
    return (
      <Page>
        {err ? (
          <Banner tone="danger" title="Couldn't load">
            {err}
          </Banner>
        ) : (
          <>
            <Skeleton height={28} width="40%" />
            <Skeleton height={14} width="60%" />
            <Skeleton height={120} />
          </>
        )}
      </Page>
    );
  }

  const nextTransitions = TRANSITIONS[doc.state] ?? [];

  return (
    <Page>
      <Header>
        <div>
          <Title>{doc.title}</Title>
          <Meta>
            {doc.public_id ? `${doc.public_id} · ` : ""}
            {new Date(doc.occurred_on).toLocaleDateString()}
            {doc.location_label ? ` · ${doc.location_label}` : ""}
            {doc.beneficiary_count ? ` · ${doc.beneficiary_count} beneficiaries` : ""}
          </Meta>
        </div>
        <Badge tone={stateTone(doc.state)}>{doc.state.replace("_", " ")}</Badge>
      </Header>

      {err && (
        <Banner tone="danger" title="Action failed">
          {err}
        </Banner>
      )}
      {info && (
        <Banner tone="success" title="Done">
          {info}
        </Banner>
      )}

      <Card>
        <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>Summary</h2>
        <p style={{ margin: 0, color: "var(--am-ink)" }}>{doc.summary}</p>
      </Card>

      <Card>
        <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>What happened</h2>
        <Body>{doc.body_markdown}</Body>
      </Card>

      {nextTransitions.length > 0 && (
        <Card>
          <h2 style={{ margin: "0 0 10px", fontSize: 16 }}>Workflow</h2>
          <Row>
            {nextTransitions.map((t) => (
              <Button
                key={t.name}
                variant={t.variant}
                disabled={busy !== null}
                onClick={() => void act(t)}
              >
                {busy === t.name ? "Working…" : t.label}
              </Button>
            ))}
          </Row>
          <Meta style={{ marginTop: 10 }}>
            Flow: draft → submitted → in review → approved → published.
            {doc.state === "approved"
              ? " Hit Publish to make this visible on the public /accomplishments page."
              : ""}
          </Meta>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <h2 style={{ margin: "0 0 10px", fontSize: 16 }}>History</h2>
          <History>
            {history.map((h) => (
              <HistoryItem key={h._id}>
                <strong>
                  {h.from_state} → {h.to_state}
                </strong>
                <span style={{ color: "var(--am-ink-muted)" }}>
                  {new Date(h.created_at).toLocaleString()}
                </span>
                {h.note ? <span>{h.note}</span> : null}
              </HistoryItem>
            ))}
          </History>
        </Card>
      )}

      <Link
        href="/admin/accomplishments"
        style={{ color: "var(--am-brand-500)", textDecoration: "none", fontSize: 14 }}
      >
        ← Back to all accomplishments
      </Link>
    </Page>
  );
}
