"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styled from "styled-components";
import { api, ApiClientError } from "@/lib/api";
import { Button as LegacyButton } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ErrorState, LoadingState } from "@/components/ui/States";
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

function stateTone(s: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (s === "posted") return "success";
  if (s === "submitted" || s === "draft") return "warning";
  if (s === "approved") return "info";
  if (s === "reversed" || s === "void") return "danger";
  return "neutral";
}

export default function TxnDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const mobile = useFlag("admin.mobileShell");
  return mobile ? <MobileTxn id={id} /> : <LegacyTxn id={id} />;
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

const Hero = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--am-ink);
`;

const Amount = styled.div`
  font-size: 32px;
  font-weight: 800;
  line-height: 40px;
  font-variant-numeric: tabular-nums;
  color: var(--am-ink);
  margin-top: 2px;
`;

const Sub = styled.div`
  font-size: 13px;
  color: var(--am-ink-muted);
`;

const SectionTitle = styled.h2`
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 600;
  color: var(--am-ink);
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  color: var(--am-ink);
`;

const Th = styled.th`
  text-align: left;
  font-weight: 600;
  color: var(--am-ink-muted);
  padding: 8px 4px;
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-bottom: 1px solid var(--am-border);
`;

const Td = styled.td`
  padding: 10px 4px;
  border-bottom: 1px solid var(--am-border);
  font-variant-numeric: tabular-nums;
  vertical-align: top;
`;

const Mono = styled.span`
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
`;

const Entries = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const EntryRow = styled.li`
  display: flex;
  gap: 10px;
  font-size: 13px;
`;

const EntryBullet = styled.span<{ $side: "debit" | "credit" }>`
  flex-shrink: 0;
  width: 28px;
  text-align: center;
  padding: 2px 6px;
  border-radius: var(--am-radius-sm);
  background: ${({ $side }) =>
    $side === "debit" ? "var(--am-danger-50)" : "var(--am-success-50)"};
  color: ${({ $side }) =>
    $side === "debit" ? "var(--am-danger-600)" : "var(--am-success-600)"};
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  line-height: 16px;
`;

const EntryBody = styled.div`
  display: flex;
  flex: 1 1 auto;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
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

const Stepper = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
`;

const Step = styled.li<{ $done: boolean; $current: boolean }>`
  position: relative;
  display: flex;
  gap: 12px;
  padding: 8px 0;

  &::before {
    content: "";
    position: absolute;
    left: 11px;
    top: 32px;
    bottom: -8px;
    width: 2px;
    background: ${({ $done }) =>
      $done ? "var(--am-success-600)" : "var(--am-border)"};
  }
  &:last-child::before {
    display: none;
  }
`;

const Dot = styled.span<{ $done: boolean; $current: boolean }>`
  width: 24px;
  height: 24px;
  border-radius: var(--am-radius-pill);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: ${({ $done, $current }) =>
    $done
      ? "var(--am-success-600)"
      : $current
        ? "var(--am-brand-600)"
        : "var(--am-bg-soft)"};
  color: ${({ $done, $current }) =>
    $done || $current ? "#fff" : "var(--am-ink-subtle)"};
  border: 2px solid
    ${({ $done, $current }) =>
      $done
        ? "var(--am-success-600)"
        : $current
          ? "var(--am-brand-600)"
          : "var(--am-border-strong)"};
  font-size: 12px;
  font-weight: 700;
`;

const StepBody = styled.div`
  flex: 1 1 auto;
  padding-bottom: 8px;
`;

const StepTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: var(--am-ink);
`;

const StepMeta = styled.div`
  font-size: 12px;
  color: var(--am-ink-muted);
  margin-top: 2px;
`;

function MobileTxn({ id }: { id: string }) {
  const toast = useAdminToast();
  const router = useRouter();
  const [doc, setDoc] = useState<Txn | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [stepup, setStepup] = useState("");
  const [acting, setActing] = useState<string | null>(null);

  const [approveOpen, setApproveOpen] = useState(false);
  const [reverseOpen, setReverseOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);

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
    setActing(action);
    try {
      await api(`/finance/transactions/${id}/action`, {
        json: {
          action,
          version: doc.version,
          reason: reason || undefined,
          stepup_token: needsStepup ? stepup : undefined,
        },
      });
      toast.push({ tone: "success", message: `${action[0].toUpperCase()}${action.slice(1)}ed` });
      setReason("");
      setStepup("");
      setApproveOpen(false);
      setReverseOpen(false);
      setVoidOpen(false);
      await load();
    } catch (e) {
      toast.push({ tone: "danger", message: (e as ApiClientError).message });
    } finally {
      setActing(null);
    }
  }

  if (!doc && !err) {
    return (
      <Page>
        <Main>
          <Skeleton height={28} width="60%" />
          <Skeleton height={40} width="40%" />
          <Card><Skeleton height={120} /></Card>
        </Main>
      </Page>
    );
  }
  if (err) {
    return (
      <Banner tone="danger" title="Couldn't load transaction" action={
        <Button variant="ghost" size="sm" onClick={() => void load()}>Retry</Button>
      }>{err}</Banner>
    );
  }
  if (!doc) return null;

  const canSubmit = doc.state === "draft";
  const canApprove = doc.state === "submitted";
  const canPost = doc.state === "approved";
  const canReverse = doc.state === "posted";
  const canVoid = ["draft", "submitted"].includes(doc.state);

  // Dual-approval stepper state. Reads Phase 6 fields on the txn — no API change.
  const steps = [
    {
      key: "created",
      title: "Created",
      meta: doc.created_by ? `by ${doc.created_by.slice(-8)}` : "—",
      done: true,
      current: false,
    },
    {
      key: "submitted",
      title: "Submitted for approval",
      meta: ["submitted", "approved", "posted", "reversed"].includes(doc.state)
        ? "Awaiting first signer"
        : doc.state === "draft"
          ? "Not yet submitted"
          : "—",
      done: ["approved", "posted", "reversed"].includes(doc.state),
      current: doc.state === "submitted",
    },
    {
      key: "approved",
      title: "Approved",
      meta: doc.approved_by
        ? `by ${doc.approved_by.slice(-8)}`
        : doc.state === "approved"
          ? "Awaiting posting"
          : "Needs a second signer",
      done: ["approved", "posted", "reversed"].includes(doc.state),
      current: doc.state === "approved",
    },
    {
      key: "posted",
      title: doc.state === "reversed" ? "Reversed" : "Posted to ledger",
      meta: doc.posted_by
        ? `by ${doc.posted_by.slice(-8)}`
        : doc.state === "posted"
          ? "Immutable from here"
          : "—",
      done: doc.state === "posted" || doc.state === "reversed",
      current: false,
    },
  ];

  return (
    <>
      <Page>
        <Main>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/admin/finance")}
            style={{ alignSelf: "flex-start" }}
          >
            ← Back to finance
          </Button>

          <Hero>
            <Title>{doc.public_id ?? doc._id.slice(0, 8)}</Title>
            <Sub>
              <Badge tone={stateTone(doc.state)}>{doc.state}</Badge>
              <span style={{ marginLeft: 8 }}>
                {doc.kind} · v{doc.version} ·{" "}
                {new Date(doc.occurred_on).toLocaleDateString()}
              </span>
            </Sub>
            <Amount>{money(doc.base_amount_cents, doc.base_currency)}</Amount>
            {doc.source_currency !== doc.base_currency && (
              <Sub>
                Original: {money(doc.source_amount_cents, doc.source_currency)}
              </Sub>
            )}
            {doc.memo && (
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 14,
                  color: "var(--am-ink-muted)",
                  lineHeight: "20px",
                }}
              >
                {doc.memo}
              </p>
            )}
          </Hero>

          <Card>
            <SectionTitle>Approval chain</SectionTitle>
            <Stepper>
              {steps.map((s, i) => (
                <Step key={s.key} $done={s.done} $current={s.current}>
                  <Dot $done={s.done} $current={s.current}>
                    {s.done ? "✓" : i + 1}
                  </Dot>
                  <StepBody>
                    <StepTitle>{s.title}</StepTitle>
                    <StepMeta>{s.meta}</StepMeta>
                  </StepBody>
                </Step>
              ))}
            </Stepper>
          </Card>

          <Card>
            <SectionTitle>Lines</SectionTitle>
            <div style={{ overflowX: "auto" }}>
              <Table>
                <thead>
                  <tr>
                    <Th>Side</Th>
                    <Th>Account</Th>
                    <Th style={{ textAlign: "right" }}>Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {doc.lines.map((l, i) => (
                    <tr key={i}>
                      <Td>
                        <Badge tone={l.side === "debit" ? "danger" : "success"}>
                          {l.side}
                        </Badge>
                      </Td>
                      <Td>
                        <Mono>{l.account}</Mono>
                        {l.memo && (
                          <div style={{ fontSize: 11, color: "var(--am-ink-muted)" }}>
                            {l.memo}
                          </div>
                        )}
                      </Td>
                      <Td style={{ textAlign: "right" }}>
                        {money(l.amount_cents, doc.base_currency)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>

          {entries.length > 0 && (
            <Card>
              <SectionTitle>Ledger entries</SectionTitle>
              <Sub style={{ marginBottom: 8 }}>Insert-only, hash chained.</Sub>
              <Entries>
                {entries.map((e) => (
                  <EntryRow key={e.seq}>
                    <EntryBullet $side={e.side}>{e.side[0]}</EntryBullet>
                    <EntryBody>
                      <div style={{ minWidth: 0 }}>
                        <strong>#{e.seq}</strong>{" "}
                        <Mono style={{ color: "var(--am-ink-muted)" }}>{e.account}</Mono>
                        <div style={{ fontSize: 11, color: "var(--am-ink-subtle)" }}>
                          <Mono>{e.hash.slice(0, 16)}…</Mono>
                        </div>
                      </div>
                      <strong style={{ fontVariantNumeric: "tabular-nums" }}>
                        {money(e.amount_cents, doc.base_currency)}
                      </strong>
                    </EntryBody>
                  </EntryRow>
                ))}
              </Entries>
            </Card>
          )}
        </Main>

        <ActionBar>
          {canSubmit && (
            <Button
              fullWidth
              loading={acting === "submit"}
              onClick={() => act("submit")}
            >
              Submit for approval
            </Button>
          )}
          {canApprove && (
            <Button fullWidth onClick={() => setApproveOpen(true)}>
              Approve
            </Button>
          )}
          {canPost && (
            <Button
              fullWidth
              loading={acting === "post"}
              onClick={() => act("post")}
            >
              Post to ledger
            </Button>
          )}
          {canReverse && (
            <Button variant="danger" fullWidth onClick={() => setReverseOpen(true)}>
              Reverse
            </Button>
          )}
          {canVoid && (
            <Button variant="secondary" fullWidth onClick={() => setVoidOpen(true)}>
              Void
            </Button>
          )}
        </ActionBar>
      </Page>

      {/* Approve sheet — requires step-up MFA */}
      <Sheet
        open={approveOpen}
        onClose={() => (acting ? undefined : setApproveOpen(false))}
        title="Approve transaction"
        description="Approving records your signature on the ledger. A step-up MFA token is required."
        dismissible={!acting}
        footer={
          <>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setApproveOpen(false)}
              disabled={Boolean(acting)}
            >
              Cancel
            </Button>
            <Button
              fullWidth
              loading={acting === "approve"}
              disabled={!stepup.trim()}
              onClick={() => act("approve", true)}
            >
              Approve
            </Button>
          </>
        }
      >
        <Field>
          <span>Reason (optional)</span>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div style={{ height: 12 }} />
        <Field>
          <span>Step-up MFA token</span>
          <Input
            value={stepup}
            onChange={(e) => setStepup(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
          />
        </Field>
      </Sheet>

      {/* Reverse sheet — destructive, needs MFA */}
      <Sheet
        open={reverseOpen}
        onClose={() => (acting ? undefined : setReverseOpen(false))}
        title="Reverse transaction"
        description="Reversal creates an opposing entry on the ledger. The original stays in history."
        dismissible={!acting}
        footer={
          <>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setReverseOpen(false)}
              disabled={Boolean(acting)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              fullWidth
              loading={acting === "reverse"}
              disabled={!stepup.trim() || !reason.trim()}
              onClick={() => act("reverse", true)}
            >
              Reverse
            </Button>
          </>
        }
      >
        <Field>
          <span>Reason (required)</span>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div style={{ height: 12 }} />
        <Field>
          <span>Step-up MFA token</span>
          <Input
            value={stepup}
            onChange={(e) => setStepup(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
          />
        </Field>
      </Sheet>

      <ConfirmDialog
        open={voidOpen}
        title="Void transaction?"
        description="A voided transaction never reaches the ledger. It stays in audit history."
        confirmLabel="Void"
        destructive
        loading={acting === "void"}
        onCancel={() => setVoidOpen(false)}
        onConfirm={() => act("void")}
      />
    </>
  );
}

/* ---------------- Legacy (preserved) ---------------- */

function LegacyTxn({ id }: { id: string }) {
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
      toast.push({ tone: "success", message: "Updated" });
      setReason("");
      void load();
    } catch (e) {
      toast.push({ tone: "danger", message: (e as ApiClientError).message });
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
        <StatusBadge tone={doc.state === "posted" ? "success" : "warning"}>{doc.state}</StatusBadge>
      </header>

      <section style={legacyCard}>
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
                <td style={{ textAlign: "right" }}>{money(l.amount_cents, doc.base_currency)}</td>
                <td>{l.memo ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {entries.length > 0 ? (
        <section style={legacyCard}>
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

      <section style={legacyCard}>
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
          {doc.state === "draft" && <LegacyButton onClick={() => act("submit")}>Submit</LegacyButton>}
          {doc.state === "submitted" && (
            <LegacyButton onClick={() => act("approve", true)}>Approve</LegacyButton>
          )}
          {doc.state === "approved" && <LegacyButton onClick={() => act("post")}>Post to ledger</LegacyButton>}
          {doc.state === "posted" && (
            <LegacyButton variant="ghost" onClick={() => act("reverse", true)}>
              Reverse
            </LegacyButton>
          )}
          {["draft", "submitted"].includes(doc.state) && (
            <LegacyButton variant="ghost" onClick={() => act("void")}>
              Void
            </LegacyButton>
          )}
          <LegacyButton variant="ghost" onClick={() => router.push("/admin/finance")}>
            Back
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
