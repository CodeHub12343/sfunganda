"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { api, ApiClientError } from "@/lib/api";
import { Button as LegacyButton } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useFlag } from "@/lib/flags";
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  FilterChip,
  ListRow,
  Modal,
  SearchField,
  Sheet,
  Skeleton,
  StatTile,
  amMedia,
  useAdminToast,
} from "@/components/admin-mobile";

export const dynamic = "force-dynamic";

// =============================================================================
// Children's future fund — safeguarding-sensitive admin surface. See
// docs/admin-mobile-redesign.md §7.11 and the Milestone 5 acceptance.
//
// Security model (never trust the client alone):
//   • Every detail-view hits `GET /beneficiaries/:id` which, server-side,
//     writes an audit row through `beneficiary/service.getBeneficiary` and
//     requires fresh step-up MFA (`requireStepUp` middleware).
//   • If step-up has lapsed the server replies 401/mfa_required; we show the
//     dedicated step-up screen and refuse to render names in the list.
//   • Names and sensitive fields never render by default — only ref_code
//     and status. A reveal is a deliberate user action per record.
// =============================================================================

type Beneficiary = {
  id: string;
  ref_code: string;
  status: "active" | "left" | "aged_out";
  program?: string | null;
};

type BeneficiaryDetail = Beneficiary & {
  name: string;
  dob: string | null;
  guardian: string | null;
  notes: string | null;
  funding?: { total_cents: number; currency: string } | null;
  updates?: { at: string; note: string }[];
  documents?: { id: string; name: string }[];
};

type Pending = {
  id: string;
  beneficiary_id: string;
  beneficiary_ref_code: string;
  public_fund_id: string;
  kind: "contribution" | "allocation" | "distribution" | "adjustment";
  amount_cents: number;
  currency: string;
  submitted_by: string;
  submitted_at: string;
  document_ref: string | null;
  note: string | null;
};

export default function AdminBeneficiaries() {
  const mobile = useFlag("admin.mobileShell");
  return mobile ? <MobileBeneficiaries /> : <LegacyBeneficiaries />;
}

/* ================================================================= */
/* Mobile                                                             */
/* ================================================================= */

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const PageTitle = styled.h1`
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--am-ink);
`;

const Subdued = styled.p`
  margin: 0;
  font-size: 13px;
  color: var(--am-ink-muted);
`;

const StatRow = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  ${amMedia.md} {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const Toolbar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const ListWrap = styled(Card)`
  padding: 0;
  overflow: hidden;
`;

const Shield = styled.span`
  display: inline-flex;
  width: 28px;
  height: 28px;
  border-radius: var(--am-radius-pill);
  background: var(--am-bg-soft);
  color: var(--am-ink-muted);
  align-items: center;
  justify-content: center;
`;

const PinnedBanner = styled.div`
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--am-warning-50, #fef3c7);
  color: var(--am-warning-700, #92400e);
  padding: 8px 12px;
  border-radius: var(--am-radius-sm);
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  border: 1px solid var(--am-warning-200, #fde68a);
  margin-bottom: 12px;
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
  font: inherit;
`;

const Textarea = styled.textarea`
  min-height: 72px;
  padding: 10px 12px;
  border-radius: var(--am-radius-md);
  background: var(--am-surface);
  color: var(--am-ink);
  border: 1px solid var(--am-border-strong);
  font: inherit;
  resize: vertical;
`;

const DetailSection = styled.section`
  background: var(--am-surface);
  padding: 12px;
  border-radius: var(--am-radius-md);
  border: 1px solid var(--am-border);
  display: flex;
  flex-direction: column;
  gap: 6px;
  dl {
    margin: 0;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 10px;
    font-size: 14px;
    dt {
      color: var(--am-ink-muted);
    }
    dd {
      margin: 0;
    }
  }
`;

const SectionHeader = styled.button`
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: transparent;
  border: 0;
  padding: 0;
  width: 100%;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--am-ink-muted);
`;

const RevealTarget = styled.button<{ $holding: boolean }>`
  width: 100%;
  padding: 20px 16px;
  border-radius: var(--am-radius-md);
  border: 2px dashed var(--am-brand-500);
  background: ${({ $holding }) =>
    $holding ? "var(--am-brand-50)" : "var(--am-bg-soft)"};
  color: var(--am-ink);
  cursor: pointer;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  user-select: none;
  touch-action: manipulation;
  &:focus-visible {
    outline: 2px solid var(--am-brand-500);
    outline-offset: 2px;
  }
`;

const fill = keyframes`
  from { width: 0; }
  to { width: 100%; }
`;

const RevealProgress = styled.div<{ $active: boolean }>`
  width: 100%;
  height: 6px;
  background: var(--am-border);
  border-radius: var(--am-radius-pill);
  overflow: hidden;
  position: relative;
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    width: 0%;
    background: var(--am-brand-600);
    border-radius: inherit;
    animation: ${({ $active }) => ($active ? fill : "none")} 900ms linear forwards;
  }
`;

const RevealOptions = styled.div`
  display: flex;
  gap: 8px;
  justify-content: center;
`;

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9 12l2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function statusTone(s: Beneficiary["status"]): "success" | "warning" | "neutral" {
  if (s === "active") return "success";
  if (s === "left") return "warning";
  return "neutral";
}

function MobileBeneficiaries() {
  const toast = useAdminToast();
  const [needsStepUp, setNeedsStepUp] = useState(false);
  const [list, setList] = useState<Beneficiary[] | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Beneficiary["status"]>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [detail, setDetail] = useState<BeneficiaryDetail | null>(null);
  const [revealing, setRevealing] = useState<Beneficiary | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [showPersonal, setShowPersonal] = useState(false);
  const [holding, setHolding] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [b, p] = await Promise.all([
        api<Beneficiary[]>("/beneficiaries"),
        api<Pending[]>("/beneficiaries/transactions/pending"),
      ]);
      setList(b);
      setPending(p);
      setNeedsStepUp(false);
    } catch (e) {
      const er = e as ApiClientError;
      if (er.code === "mfa_required" || er.code === "unauthorized") {
        setNeedsStepUp(true);
      } else if (er.code === "unavailable") {
        setErr(
          "The children's fund is not enabled on this environment. Legal sign-off and the private database must be configured first."
        );
      } else {
        setErr(er.message);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!list) return null;
    const q = query.trim().toLowerCase();
    return list.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (!q) return true;
      return (
        b.ref_code.toLowerCase().includes(q) ||
        (b.program ?? "").toLowerCase().includes(q)
      );
    });
  }, [list, query, statusFilter]);

  const stats = useMemo(() => {
    const active = list?.filter((b) => b.status === "active").length ?? 0;
    return {
      supported: list?.length ?? 0,
      active,
      pending: pending.length,
    };
  }, [list, pending]);

  function startHold(target: Beneficiary) {
    setRevealError(null);
    setHolding(true);
    holdTimer.current = setTimeout(() => {
      setHolding(false);
      void doReveal(target);
    }, 900);
  }

  function cancelHold() {
    setHolding(false);
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }

  async function doReveal(target: Beneficiary) {
    try {
      // GET /beneficiaries/:id logs a server-side audit event per view.
      const r = await api<BeneficiaryDetail>(`/beneficiaries/${target.id}`);
      setDetail(r);
      setRevealing(null);
      setShowPersonal(false);
    } catch (e) {
      const er = e as ApiClientError;
      if (er.code === "mfa_required") {
        setNeedsStepUp(true);
        setRevealing(null);
        toast.push({ tone: "danger", message: "Step-up MFA required." });
        return;
      }
      setRevealError(er.message);
    }
  }

  async function act(path: string, body?: unknown, successMsg = "Updated") {
    try {
      await api(path, { json: body ?? {} });
      toast.push({ tone: "success", message: successMsg });
      await load();
    } catch (e) {
      const er = e as ApiClientError;
      if (er.code === "mfa_required") {
        setNeedsStepUp(true);
        toast.push({ tone: "danger", message: "Step-up MFA required." });
      } else {
        toast.push({ tone: "danger", message: er.message });
      }
    }
  }

  if (needsStepUp) {
    return <MobileStepUp onSuccess={() => void load()} />;
  }

  if (err) return <ErrorState message={err} retry={load} />;

  return (
    <Page>
      <PageTitle>Children&apos;s fund</PageTitle>
      <Subdued>
        Private records. Every detail view is audited server-side. No individual record
        is reachable from a public endpoint.
      </Subdued>

      <StatRow>
        <StatTile label="Children supported" value={list ? stats.supported : "—"} />
        <StatTile label="Active" value={list ? stats.active : "—"} />
        <StatTile label="Pending approvals" value={pending.length} />
      </StatRow>

      {pending.length > 0 && (
        <Card>
          <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 14 }}>Pending approvals</h3>
          {pending.map((p) => (
            <div
              key={p.id}
              style={{
                padding: "10px 0",
                borderTop: "1px solid var(--am-border)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong>
                  {p.kind} · <code>{p.beneficiary_ref_code}</code>
                </strong>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {(p.amount_cents / 100).toLocaleString(undefined, {
                    style: "currency",
                    currency: p.currency,
                  })}
                </span>
              </div>
              {p.note ? (
                <div style={{ fontSize: 13, color: "var(--am-ink)" }}>{p.note}</div>
              ) : null}
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() =>
                    void act(
                      `/beneficiaries/transactions/${p.id}/approve`,
                      {},
                      "Approved."
                    )
                  }
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void act(
                      `/beneficiaries/transactions/${p.id}/reject`,
                      { note: "rejected via admin" },
                      "Rejected."
                    )
                  }
                >
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Toolbar>
        <SearchField
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
          placeholder="Search by ref code or programme"
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <FilterChip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
            All
          </FilterChip>
          <FilterChip
            active={statusFilter === "active"}
            onClick={() => setStatusFilter("active")}
          >
            Active
          </FilterChip>
          <FilterChip active={statusFilter === "left"} onClick={() => setStatusFilter("left")}>
            Left
          </FilterChip>
          <FilterChip
            active={statusFilter === "aged_out"}
            onClick={() => setStatusFilter("aged_out")}
          >
            Aged out
          </FilterChip>
          <div style={{ marginLeft: "auto" }}>
            <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
              + Add child
            </Button>
          </div>
        </div>
      </Toolbar>

      {list === null ? (
        <Card padding="none">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                padding: 14,
                borderTop: i === 0 ? 0 : "1px solid var(--am-border)",
              }}
            >
              <Skeleton height={14} width="40%" />
              <div style={{ height: 6 }} />
              <Skeleton height={10} width="20%" />
            </div>
          ))}
        </Card>
      ) : filtered && filtered.length === 0 ? (
        <Card padding="none">
          <EmptyState
            title={list.length === 0 ? "No records yet" : "No matches"}
            description={
              list.length === 0
                ? "Add the first child record to start tracking."
                : "Try a different search or filter."
            }
          />
        </Card>
      ) : (
        <ListWrap>
          {filtered!.map((b) => (
            <ListRow
              key={b.id}
              leading={<Avatar name={b.ref_code} size="md" />}
              title={
                <span style={{ fontFamily: "var(--am-font-mono, monospace)" }}>
                  {b.ref_code}
                </span>
              }
              meta={b.program ?? "No programme"}
              onClick={() => setRevealing(b)}
              trailing={
                <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  <Badge tone={statusTone(b.status)}>{b.status.replace("_", " ")}</Badge>
                  <Shield title="Sensitive — tap to view">
                    <ShieldIcon />
                  </Shield>
                </span>
              }
            />
          ))}
        </ListWrap>
      )}

      {/* Reveal gate — tap-and-hold OR explicit button (safeguarding-lead preference) */}
      <Modal
        open={!!revealing}
        onClose={() => {
          cancelHold();
          setRevealing(null);
          setRevealError(null);
        }}
        title={revealing ? `Reveal ${revealing.ref_code}?` : "Reveal record?"}
        description="This opens a sensitive record. Your access will be logged for audit."
        size="sm"
        footer={null}
      >
        {revealing && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <RevealTarget
              type="button"
              $holding={holding}
              onPointerDown={() => startHold(revealing)}
              onPointerUp={cancelHold}
              onPointerLeave={cancelHold}
              onPointerCancel={cancelHold}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  void doReveal(revealing);
                }
              }}
              aria-label="Press and hold to reveal"
            >
              <strong>Press and hold to reveal</strong>
              <RevealProgress $active={holding} />
              <Subdued>Prevents accidental shoulder-surfing reveals.</Subdued>
            </RevealTarget>
            <RevealOptions>
              <Button
                variant="secondary"
                onClick={() => {
                  cancelHold();
                  void doReveal(revealing);
                }}
              >
                Reveal now
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  cancelHold();
                  setRevealing(null);
                }}
              >
                Cancel
              </Button>
            </RevealOptions>
            {revealError ? (
              <Banner tone="danger" title="Could not reveal">
                {revealError}
              </Banner>
            ) : null}
          </div>
        )}
      </Modal>

      {/* Detail — audit banner stays pinned */}
      <Sheet
        open={!!detail}
        onClose={() => setDetail(null)}
        variant="full"
        title={detail ? detail.ref_code : ""}
        description={detail?.program ?? undefined}
      >
        {detail && (
          <>
            <PinnedBanner role="status">
              <ShieldIcon />
              <span>Your access to this record is being logged.</span>
            </PinnedBanner>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <DetailSection>
                <SectionHeader
                  type="button"
                  onClick={() => setShowPersonal((v) => !v)}
                  aria-expanded={showPersonal}
                >
                  <span>Personal</span>
                  <span>{showPersonal ? "Hide" : "Show"}</span>
                </SectionHeader>
                {showPersonal ? (
                  <dl>
                    <dt>Name</dt>
                    <dd>{detail.name}</dd>
                    <dt>Date of birth</dt>
                    <dd>{detail.dob ?? "—"}</dd>
                    <dt>Status</dt>
                    <dd>
                      <Badge tone={statusTone(detail.status)}>
                        {detail.status.replace("_", " ")}
                      </Badge>
                    </dd>
                  </dl>
                ) : (
                  <Subdued>
                    Personal details are hidden by default. Expand to view.
                  </Subdued>
                )}
              </DetailSection>

              <DetailSection>
                <strong style={{ fontSize: 13, color: "var(--am-ink-muted)" }}>
                  Guardian / contact
                </strong>
                <p style={{ margin: 0 }}>{detail.guardian ?? "—"}</p>
              </DetailSection>

              {detail.notes ? (
                <DetailSection>
                  <strong style={{ fontSize: 13, color: "var(--am-ink-muted)" }}>Notes</strong>
                  <p style={{ margin: 0 }}>{detail.notes}</p>
                </DetailSection>
              ) : null}

              {detail.funding ? (
                <DetailSection>
                  <strong style={{ fontSize: 13, color: "var(--am-ink-muted)" }}>
                    Funding ledger
                  </strong>
                  <p style={{ margin: 0, fontVariantNumeric: "tabular-nums" }}>
                    {(detail.funding.total_cents / 100).toLocaleString(undefined, {
                      style: "currency",
                      currency: detail.funding.currency,
                    })}
                  </p>
                </DetailSection>
              ) : null}

              {detail.updates && detail.updates.length > 0 ? (
                <DetailSection>
                  <strong style={{ fontSize: 13, color: "var(--am-ink-muted)" }}>Updates</strong>
                  {detail.updates.map((u, i) => (
                    <div key={i} style={{ fontSize: 13 }}>
                      <span style={{ color: "var(--am-ink-muted)" }}>
                        {new Date(u.at).toLocaleDateString()} —{" "}
                      </span>
                      {u.note}
                    </div>
                  ))}
                </DetailSection>
              ) : null}

              {detail.documents && detail.documents.length > 0 ? (
                <DetailSection>
                  <strong style={{ fontSize: 13, color: "var(--am-ink-muted)" }}>Documents</strong>
                  {detail.documents.map((d) => (
                    <div key={d.id}>{d.name}</div>
                  ))}
                </DetailSection>
              ) : null}
            </div>
          </>
        )}
      </Sheet>

      <AddSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onDone={async () => {
          setAddOpen(false);
          await load();
          toast.push({ tone: "success", message: "Added." });
        }}
      />
    </Page>
  );
}

function AddSheet({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useAdminToast();
  const [form, setForm] = useState({ name: "", dob: "", guardian: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      await api("/beneficiaries", { json: form });
      setForm({ name: "", dob: "", guardian: "", notes: "" });
      onDone();
    } catch (e) {
      toast.push({
        tone: "danger",
        message: (e as ApiClientError).message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title="Add child"
      description="Name and personal details are encrypted at rest."
      dismissible={!submitting}
      footer={
        <>
          <Button variant="secondary" fullWidth onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button fullWidth loading={submitting} disabled={!form.name} onClick={submit}>
            Add
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field>
          <span>Name</span>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoFocus
            required
          />
        </Field>
        <Field>
          <span>Date of birth</span>
          <Input
            type="date"
            value={form.dob}
            onChange={(e) => setForm({ ...form, dob: e.target.value })}
          />
        </Field>
        <Field>
          <span>Guardian</span>
          <Input
            value={form.guardian}
            onChange={(e) => setForm({ ...form, guardian: e.target.value })}
          />
        </Field>
        <Field>
          <span>Notes</span>
          <Textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            maxLength={2000}
          />
        </Field>
      </div>
    </Sheet>
  );
}

const StepUpWrap = styled(Card)`
  max-width: 420px;
  margin: 40px auto 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: center;
`;

const OTPInput = styled.input`
  width: 100%;
  padding: 12px;
  font-size: 24px;
  text-align: center;
  letter-spacing: 0.4rem;
  border: 1px solid var(--am-border-strong);
  border-radius: var(--am-radius-md);
  background: var(--am-surface);
  color: var(--am-ink);
  &:focus {
    outline: 2px solid var(--am-brand-500);
    outline-offset: 2px;
    border-color: var(--am-brand-500);
  }
`;

function MobileStepUp({ onSuccess }: { onSuccess: () => void }) {
  const toast = useAdminToast();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setBusy(true);
    try {
      await api("/beneficiaries/step-up", { json: { code } });
      toast.push({ tone: "success", message: "MFA verified." });
      onSuccess();
    } catch (e) {
      toast.push({ tone: "danger", message: (e as ApiClientError).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <PinnedBanner role="status">
        <ShieldIcon />
        <span>Step-up MFA has lapsed. Re-verify to continue.</span>
      </PinnedBanner>
      <StepUpWrap>
        <ShieldIcon />
        <h2 style={{ margin: 0, fontSize: 18 }}>Step-up MFA required</h2>
        <Subdued>
          Enter your current authenticator code to view children&apos;s-fund records.
          This confirms a human initiated the access.
        </Subdued>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <OTPInput
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="••••••"
            aria-label="Six-digit authenticator code"
          />
          <Button type="submit" disabled={code.length !== 6} loading={busy} fullWidth>
            Verify
          </Button>
        </form>
      </StepUpWrap>
    </Page>
  );
}

/* ================================================================= */
/* Legacy fallback                                                    */
/* ================================================================= */

function LegacyBeneficiaries() {
  const toast = useToast();
  const [needsStepUp, setNeedsStepUp] = useState(false);
  const [list, setList] = useState<Beneficiary[] | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [b, p] = await Promise.all([
        api<Beneficiary[]>("/beneficiaries"),
        api<Pending[]>("/beneficiaries/transactions/pending"),
      ]);
      setList(b);
      setPending(p);
      setNeedsStepUp(false);
    } catch (e) {
      const er = e as ApiClientError;
      if (er.code === "mfa_required" || er.code === "unauthorized") {
        setNeedsStepUp(true);
      } else if (er.code === "unavailable") {
        setErr(
          "The children's fund is not enabled on this environment."
        );
      } else {
        setErr(er.message);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(path: string, body?: unknown) {
    try {
      await api(path, { json: body ?? {} });
      toast.push({ tone: "success", message: "Updated" });
      await load();
    } catch (e) {
      const er = e as ApiClientError;
      if (er.code === "mfa_required") {
        setNeedsStepUp(true);
        toast.push({ tone: "danger", message: "Step-up MFA required" });
      } else {
        toast.push({ tone: "danger", message: er.message });
      }
    }
  }

  if (needsStepUp) return <LegacyStepUp onSuccess={() => void load()} />;
  if (err) return <ErrorState message={err} retry={load} />;
  if (list === null) return <LoadingState />;

  return (
    <section>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Children&apos;s future fund</h1>
        <LegacyButton onClick={() => setAdding(true)}>Add child</LegacyButton>
      </header>
      <p style={{ color: "#6b7280" }}>Private records. Reads and writes are audited.</p>
      {adding ? (
        <LegacyAdd
          onDone={() => {
            setAdding(false);
            void load();
          }}
        />
      ) : null}
      <section style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>Pending approvals ({pending.length})</h2>
        {pending.length === 0 ? (
          <p style={{ color: "#6b7280" }}>Nothing waiting.</p>
        ) : (
          <ul style={{ paddingLeft: 0, listStyle: "none" }}>
            {pending.map((p) => (
              <li
                key={p.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: "0.75rem 1rem",
                  marginBottom: "0.5rem",
                  background: "#fff",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>
                    {p.kind} — {p.beneficiary_ref_code}
                  </strong>
                  <span>
                    {(p.amount_cents / 100).toLocaleString(undefined, {
                      style: "currency",
                      currency: p.currency,
                    })}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <LegacyButton
                    onClick={() => void act(`/beneficiaries/transactions/${p.id}/approve`)}
                  >
                    Approve
                  </LegacyButton>
                  <LegacyButton
                    variant="ghost"
                    onClick={() =>
                      void act(`/beneficiaries/transactions/${p.id}/reject`, {
                        note: "rejected via admin",
                      })
                    }
                  >
                    Reject
                  </LegacyButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>Children ({list.length})</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Ref code</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map((b) => (
              <tr key={b.id}>
                <td style={{ padding: "0.4rem 0", fontFamily: "monospace" }}>{b.ref_code}</td>
                <td>{b.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </section>
  );
}

function LegacyStepUp({ onSuccess }: { onSuccess: () => void }) {
  const toast = useToast();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/beneficiaries/step-up", { json: { code } });
      toast.push({ tone: "success", message: "MFA verified" });
      onSuccess();
    } catch (e) {
      toast.push({ tone: "danger", message: (e as ApiClientError).message });
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      style={{
        maxWidth: 420,
        margin: "4rem auto",
        padding: "1.5rem",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        background: "#fff",
      }}
    >
      <h1 style={{ margin: 0 }}>Step-up MFA required</h1>
      <p style={{ color: "#6b7280" }}>Enter your authenticator code to continue.</p>
      <form onSubmit={submit}>
        <input
          autoFocus
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="123456"
          style={{
            width: "100%",
            padding: "0.6rem",
            fontSize: "1.3rem",
            textAlign: "center",
            letterSpacing: "0.4rem",
          }}
        />
        <LegacyButton type="submit" disabled={code.length !== 6 || busy}>
          Verify
        </LegacyButton>
      </form>
    </section>
  );
}

function LegacyAdd({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", dob: "", guardian: "", notes: "" });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/beneficiaries", { json: form });
      toast.push({ tone: "success", message: "Added" });
      onDone();
    } catch (e) {
      toast.push({ tone: "danger", message: (e as ApiClientError).message });
    }
  }
  return (
    <form
      onSubmit={submit}
      style={{
        marginTop: "1rem",
        padding: "1rem",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        background: "#fff",
      }}
    >
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        Name *
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          style={{ width: "100%" }}
        />
      </label>
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        Date of birth
        <input
          type="date"
          value={form.dob}
          onChange={(e) => setForm({ ...form, dob: e.target.value })}
          style={{ width: "100%" }}
        />
      </label>
      <LegacyButton type="submit">Add</LegacyButton>
    </form>
  );
}
