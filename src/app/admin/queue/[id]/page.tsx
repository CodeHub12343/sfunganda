"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styled from "styled-components";
import { api, ApiClientError } from "@/lib/api";
import { Button as LegacyButton } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { AiDraftPanel } from "@/components/ai/AiDraftPanel";
import { PostStatusList } from "@/components/social/PostStatusList";
import { useFlag } from "@/lib/flags";
import {
  Badge,
  Banner,
  Button,
  Card,
  ConfirmDialog,
  Sheet,
  Skeleton,
  amMedia,
  useAdminToast,
} from "@/components/admin-mobile";

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
  ai_assisted?: boolean;
  ai_attestation_at?: string | null;
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

type Safeguarding = {
  consent_recorded: boolean;
  no_minor_identifiers: boolean;
  images_appropriate: boolean;
  names_scrubbed: boolean;
};

const EMPTY_SG: Safeguarding = {
  consent_recorded: false,
  no_minor_identifiers: false,
  images_appropriate: false,
  names_scrubbed: false,
};

function stateTone(s: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (s === "approved" || s === "published") return "success";
  if (s === "submitted" || s === "in_review") return "warning";
  if (s === "changes_requested") return "info";
  if (s === "rejected") return "danger";
  return "neutral";
}

export default function ReviewScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const mobile = useFlag("admin.mobileShell");
  return mobile ? <MobileReview id={id} /> : <LegacyReview id={id} />;
}

/* ---------------- Mobile ---------------- */

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: calc(96px + env(safe-area-inset-bottom));

  ${amMedia.lg} {
    padding-bottom: 0;
    display: grid;
    grid-template-columns: 1fr 340px;
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

const Hero = styled.div``;

const Title = styled.h1`
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--am-ink);
  letter-spacing: -0.01em;
`;

const SubRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  font-size: 13px;
  color: var(--am-ink-muted);
  flex-wrap: wrap;
`;

const Summary = styled.p`
  margin: 0;
  font-size: 15px;
  line-height: 22px;
  color: var(--am-ink);
`;

const DiffBox = styled.pre`
  margin: 0;
  padding: 12px;
  background: var(--am-bg-soft);
  border-radius: var(--am-radius-md);
  overflow-x: auto;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
  line-height: 18px;
  color: var(--am-ink);
`;

const DiffLine = styled.div<{ $kind: "same" | "add" | "del" }>`
  padding: 0 4px;
  white-space: pre-wrap;
  background: ${({ $kind }) =>
    $kind === "add"
      ? "rgba(5, 150, 105, 0.12)"
      : $kind === "del"
        ? "rgba(220, 38, 38, 0.12)"
        : "transparent"};
  color: ${({ $kind }) =>
    $kind === "add"
      ? "var(--am-success-600)"
      : $kind === "del"
        ? "var(--am-danger-600)"
        : "var(--am-ink)"};
`;

const DL = styled.dl`
  margin: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
`;

const DT = styled.dt`
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--am-ink-subtle);
`;

const DD = styled.dd`
  margin: 0;
  font-size: 14px;
  color: var(--am-ink);
`;

const Timeline = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const TLItem = styled.li`
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: var(--am-ink-muted);
`;

const TLDot = styled.span`
  flex-shrink: 0;
  margin-top: 6px;
  width: 8px;
  height: 8px;
  border-radius: var(--am-radius-pill);
  background: var(--am-brand-500);
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

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--am-ink-muted);
`;

const Textarea = styled.textarea`
  min-height: 100px;
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

const Checklist = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const CheckRow = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--am-radius-md);
  background: var(--am-bg-soft);
  cursor: pointer;
  font-size: 14px;
  color: var(--am-ink);
`;

function MobileReview({ id }: { id: string }) {
  const toast = useAdminToast();
  const router = useRouter();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [sg, setSg] = useState<Safeguarding>(EMPTY_SG);
  const [note, setNote] = useState("");
  const [aiAttested, setAiAttested] = useState(false);
  const [acting, setActing] = useState(false);

  const [approveOpen, setApproveOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

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

  async function act(
    transition: string,
    payload: Record<string, unknown> = {},
    successMessage = "Updated"
  ) {
    if (!doc) return;
    setActing(true);
    try {
      await api(`/accomplishments/${id}/transition`, {
        json: { transition, version: doc.version, ...payload },
      });
      toast.push({ tone: "success", message: successMessage });
      await load();
      // Close any open sheets after a successful action.
      setApproveOpen(false);
      setRequestOpen(false);
      setRejectOpen(false);
      setNote("");
    } catch (e) {
      toast.push({ tone: "danger", message: (e as ApiClientError).message });
    } finally {
      setActing(false);
    }
  }

  if (!doc && !err) {
    return (
      <Page>
        <Main>
          <Skeleton height={28} width="60%" />
          <Skeleton height={14} width="40%" />
          <Card><Skeleton height={60} /></Card>
          <Card><Skeleton height={160} /></Card>
        </Main>
      </Page>
    );
  }
  if (err) {
    return (
      <Banner tone="danger" title="Couldn't load item" action={
        <Button variant="ghost" size="sm" onClick={() => void load()}>Retry</Button>
      }>
        {err}
      </Banner>
    );
  }
  if (!doc) return null;

  const previous = revisions[1]?.snapshot ?? null;
  const needsAttest = Boolean(doc.ai_assisted) && !doc.ai_attestation_at;
  const canClaim = doc.state === "submitted";
  const canReview = doc.state === "in_review";
  const canPublish = doc.state === "approved";
  const canSubmit = doc.state === "draft" || doc.state === "changes_requested";

  const sgAllChecked = Object.values(sg).every(Boolean);

  return (
    <>
      <Page>
        <Main>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/admin/queue")}
            style={{ alignSelf: "flex-start" }}
          >
            ← Back to queue
          </Button>

          <Hero>
            <Title>{doc.title}</Title>
            <SubRow>
              <Badge tone={stateTone(doc.state)}>{doc.state.replace("_", " ")}</Badge>
              <span>v{doc.version}</span>
              {doc.public_id && <span>· {doc.public_id}</span>}
            </SubRow>
          </Hero>

          {doc.ai_assisted && (
            <Banner tone="info" title="AI-assisted draft">
              Confirm facts against the field report before publishing.
            </Banner>
          )}

          <Card>
            <Summary>{doc.summary}</Summary>
          </Card>

          <Card>
            <h2 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 600 }}>
              Content {previous ? "— changes vs. previous version" : ""}
            </h2>
            <RevisionDiff before={previous?.body_markdown ?? ""} after={doc.body_markdown} />
          </Card>

          <Card>
            <h2 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 600 }}>Details</h2>
            <DL>
              <DT>Occurred on</DT>
              <DD>{new Date(doc.occurred_on).toLocaleDateString()}</DD>
              <DT>Location</DT>
              <DD>{doc.location_label ?? "—"}</DD>
              <DT>Beneficiaries</DT>
              <DD>{doc.beneficiary_count ?? "—"}</DD>
              <DT>Media attached</DT>
              <DD>{doc.media_asset_ids.length}</DD>
            </DL>
          </Card>

          {canReview && (
            <AiDraftPanel
              accomplishmentId={doc._id}
              seedBody={doc.body_markdown}
              onAccepted={() => void load()}
            />
          )}

          <PostStatusList accomplishmentId={doc._id} />

          <Button variant="secondary" onClick={() => setHistoryOpen(true)}>
            View history ({history.length})
          </Button>
        </Main>

        <ActionBar>
          {canClaim && (
            <Button
              fullWidth
              loading={acting}
              onClick={() => act("claim_review", {}, "Claimed for review")}
            >
              Claim for review
            </Button>
          )}
          {canReview && (
            <>
              <Button
                variant="secondary"
                fullWidth
                disabled={acting}
                onClick={() => setRejectOpen(true)}
              >
                Reject
              </Button>
              <Button
                variant="secondary"
                fullWidth
                disabled={acting}
                onClick={() => setRequestOpen(true)}
              >
                Changes
              </Button>
              <Button
                fullWidth
                disabled={acting}
                onClick={() => setApproveOpen(true)}
              >
                Approve
              </Button>
            </>
          )}
          {canPublish && (
            <Button
              fullWidth
              loading={acting}
              onClick={() => act("publish", {}, "Published")}
            >
              Publish
            </Button>
          )}
          {canSubmit && (
            <Button
              fullWidth
              loading={acting}
              onClick={() => act("submit", { note }, "Submitted for review")}
            >
              Submit for review
            </Button>
          )}
          {!canClaim && !canReview && !canPublish && !canSubmit && (
            <Button variant="secondary" fullWidth onClick={() => router.push("/admin/queue")}>
              No actions available — back to queue
            </Button>
          )}
        </ActionBar>
      </Page>

      {/* Approve sheet with safeguarding checklist + optional AI attestation */}
      <Sheet
        open={approveOpen}
        onClose={() => (acting ? undefined : setApproveOpen(false))}
        title="Approve"
        description="Confirm safeguarding checks before approving."
        dismissible={!acting}
        footer={
          <>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setApproveOpen(false)}
              disabled={acting}
            >
              Cancel
            </Button>
            <Button
              fullWidth
              loading={acting}
              disabled={!sgAllChecked || (needsAttest && !aiAttested)}
              onClick={() =>
                act(
                  "approve",
                  {
                    safeguarding: sg,
                    note,
                    ai_attestation: needsAttest ? aiAttested : undefined,
                  },
                  "Approved"
                )
              }
            >
              Approve
            </Button>
          </>
        }
      >
        <Checklist>
          {(
            [
              ["consent_recorded", "Consent recorded for every subject"],
              ["no_minor_identifiers", "No minor identifiers visible"],
              ["images_appropriate", "Images are appropriate for public release"],
              ["names_scrubbed", "Names scrubbed where consent was partial"],
            ] as [keyof Safeguarding, string][]
          ).map(([k, label]) => (
            <CheckRow key={k}>
              <input
                type="checkbox"
                checked={sg[k]}
                onChange={(e) => setSg({ ...sg, [k]: e.target.checked })}
              />
              <span>{label}</span>
            </CheckRow>
          ))}
        </Checklist>
        {needsAttest && (
          <>
            <div style={{ height: 12 }} />
            <Banner tone="info">
              <CheckRow style={{ background: "transparent", padding: 0 }}>
                <input
                  type="checkbox"
                  checked={aiAttested}
                  onChange={(e) => setAiAttested(e.target.checked)}
                />
                <span>I have checked this against the field report (required for AI-assisted content).</span>
              </CheckRow>
            </Banner>
          </>
        )}
        <div style={{ height: 12 }} />
        <Field>
          <span>Note (optional)</span>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add context for the next reviewer or the author."
          />
        </Field>
      </Sheet>

      {/* Request changes sheet */}
      <Sheet
        open={requestOpen}
        onClose={() => (acting ? undefined : setRequestOpen(false))}
        title="Request changes"
        description="Tell the author what to fix. They'll see this when they open the item."
        dismissible={!acting}
        footer={
          <>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setRequestOpen(false)}
              disabled={acting}
            >
              Cancel
            </Button>
            <Button
              fullWidth
              loading={acting}
              disabled={note.trim().length === 0}
              onClick={() =>
                act("request_changes", { note }, "Changes requested")
              }
            >
              Send
            </Button>
          </>
        }
      >
        <Field>
          <span>Note</span>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Describe what needs to change."
            autoFocus
          />
        </Field>
      </Sheet>

      {/* Reject confirm — destructive */}
      <ConfirmDialog
        open={rejectOpen}
        title={`Reject "${doc.title}"?`}
        description="Rejection removes the item from the active queue. The author will be notified."
        confirmLabel="Reject"
        destructive
        loading={acting}
        onCancel={() => setRejectOpen(false)}
        onConfirm={() => act("reject", { note }, "Rejected")}
      />

      {/* History sheet */}
      <Sheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="History"
        description="Every state change on this item."
      >
        {history.length === 0 ? (
          <p style={{ color: "var(--am-ink-muted)" }}>No history yet.</p>
        ) : (
          <Timeline>
            {history.map((h, i) => (
              <TLItem key={i}>
                <TLDot aria-hidden="true" />
                <div style={{ flex: 1 }}>
                  <strong style={{ color: "var(--am-ink)" }}>
                    {h.kind.replace("_", " ")}
                  </strong>
                  <div>
                    {h.from_state} → {h.to_state} ·{" "}
                    {new Date(h.created_at).toLocaleString()}
                  </div>
                  {h.note && (
                    <div style={{ color: "var(--am-ink)", marginTop: 4 }}>{h.note}</div>
                  )}
                </div>
              </TLItem>
            ))}
          </Timeline>
        )}
      </Sheet>
    </>
  );
}

function RevisionDiff({ before, after }: { before: string; after: string }) {
  if (!before) {
    return <DiffBox>{after}</DiffBox>;
  }
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const max = Math.max(beforeLines.length, afterLines.length);
  const rows: { kind: "same" | "add" | "del"; text: string }[] = [];
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
    <DiffBox>
      {rows.map((r, i) => (
        <DiffLine key={i} $kind={r.kind}>
          {r.kind === "add" ? "+ " : r.kind === "del" ? "- " : "  "}
          {r.text}
        </DiffLine>
      ))}
    </DiffBox>
  );
}

/* ---------------- Legacy (preserved) ---------------- */

function LegacyReview({ id }: { id: string }) {
  const toast = useToast();
  const router = useRouter();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [sg, setSg] = useState<Safeguarding>(EMPTY_SG);
  const [note, setNote] = useState("");
  const [aiAttested, setAiAttested] = useState(false);

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
      toast.push({ tone: "success", message: "Updated" });
      await load();
    } catch (e) {
      toast.push({ tone: "danger", message: (e as ApiClientError).message });
    }
  }

  if (!doc && !err) return <LoadingState />;
  if (err) return <ErrorState message={err} onRetry={() => void load()} />;
  if (!doc) return null;

  const previous = revisions[1]?.snapshot ?? null;
  const needsAttest = Boolean(doc.ai_assisted) && !doc.ai_attestation_at;
  const can = (states: string[]) => states.includes(doc.state);

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
        <LegacyButton variant="ghost" onClick={() => router.push("/admin/queue")}>
          Back
        </LegacyButton>
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
          {doc.ai_assisted ? (
            <div
              style={{
                background: "#eff6ff",
                border: "1px solid #93c5fd",
                color: "#1e3a8a",
                padding: "0.5rem 0.75rem",
                borderRadius: 6,
                fontSize: "0.9rem",
                marginBottom: "0.5rem",
              }}
            >
              This item was drafted with the AI assistant. The approver must confirm facts
              against the field report before publication.
            </div>
          ) : null}
          <RevisionDiff before={previous?.body_markdown ?? ""} after={doc.body_markdown} />
          {can(["in_review", "submitted"]) ? (
            <section style={{ marginTop: "1rem" }}>
              <AiDraftPanel
                accomplishmentId={doc._id}
                seedBody={doc.body_markdown}
                onAccepted={() => void load()}
              />
            </section>
          ) : null}
          <PostStatusList accomplishmentId={doc._id} />
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
          <label style={{ display: "block", margin: "0.5rem 0" }}>
            <span style={{ display: "block", fontSize: "0.85rem", color: "#6b7280" }}>Note</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              style={{
                width: "100%",
                padding: "0.5rem",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
              }}
            />
          </label>
          {can(["submitted"]) ? (
            <LegacyButton variant="primary" onClick={() => act("claim_review")}>
              Claim for review
            </LegacyButton>
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
                      onChange={(e) => setSg({ ...sg, [k]: e.target.checked } as Safeguarding)}
                    />{" "}
                    {k.replace(/_/g, " ")}
                  </label>
                ))}
              </fieldset>
              {needsAttest ? (
                <label
                  style={{
                    display: "block",
                    margin: "0.75rem 0",
                    padding: "0.5rem 0.75rem",
                    background: "#eff6ff",
                    border: "1px solid #93c5fd",
                    borderRadius: 6,
                    fontSize: "0.9rem",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={aiAttested}
                    onChange={(e) => setAiAttested(e.target.checked)}
                  />{" "}
                  I have checked this against the field report (required for AI-assisted content).
                </label>
              ) : null}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <LegacyButton
                  variant="primary"
                  onClick={() =>
                    act("approve", {
                      safeguarding: sg,
                      note,
                      ai_attestation: needsAttest ? aiAttested : undefined,
                    })
                  }
                  disabled={needsAttest && !aiAttested}
                >
                  Approve
                </LegacyButton>
                <LegacyButton variant="secondary" onClick={() => act("request_changes", { note })}>
                  Request changes
                </LegacyButton>
                <LegacyButton variant="ghost" onClick={() => act("reject", { note })}>
                  Reject
                </LegacyButton>
              </div>
            </>
          ) : null}
          {can(["approved"]) ? (
            <LegacyButton variant="primary" onClick={() => act("publish")}>Publish</LegacyButton>
          ) : null}
          {can(["draft", "changes_requested"]) ? (
            <LegacyButton variant="primary" onClick={() => act("submit", { note })}>
              Submit for review
            </LegacyButton>
          ) : null}

          <h3 style={{ marginTop: "1.5rem" }}>History</h3>
          <ol style={{ paddingLeft: "1.1rem", fontSize: "0.9rem" }}>
            {history.map((h, i) => (
              <li key={i} style={{ marginBottom: "0.4rem" }}>
                <strong>{h.kind.replace("_", " ")}</strong>{" "}
                <small style={{ color: "#6b7280" }}>
                  {h.from_state} → {h.to_state} ·{" "}
                  {new Date(h.created_at).toLocaleString()}
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
