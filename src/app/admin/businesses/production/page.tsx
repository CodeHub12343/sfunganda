"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { Button as LegacyButton } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  EmptyState as LegacyEmpty,
  ErrorState,
  LoadingState,
} from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, ApiClientError } from "@/lib/api";
import { useFlag } from "@/lib/flags";
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  SearchField,
  SegmentedControl,
  Sheet,
  Skeleton,
  amMedia,
  useAdminToast,
} from "@/components/admin-mobile";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  business_id: string;
  caption: string;
  quantity: number;
  unit: string;
  source_currency: string;
  gross_source_cents: number;
  gross_base_cents: number;
  occurred_on: string;
  state: "draft" | "submitted" | "approved" | "posted" | "rejected" | "reversed";
  submitted_by?: string | null;
  rejected_reason?: string | null;
  due_on?: string | null;
};

type Business = { id: string; name: string };

type Me = {
  user: { id: string; email: string; display_name: string } | null;
  assignments: { role: string; scope_type: string; scope_id: string | null }[];
};

export default function AdminProduction() {
  const mobile = useFlag("admin.mobileShell");
  return mobile ? <MobileProduction /> : <LegacyProduction />;
}

/* ================================================================= */
/* Mobile                                                             */
/* ================================================================= */

const BUCKETS = [
  { value: "open" as const, label: "Open" },
  { value: "progress" as const, label: "In progress" },
  { value: "blocked" as const, label: "Blocked" },
  { value: "done" as const, label: "Done" },
];
type Bucket = (typeof BUCKETS)[number]["value"];

function bucketOf(state: Row["state"]): Bucket {
  if (state === "submitted" || state === "draft") return "open";
  if (state === "approved") return "progress";
  if (state === "rejected") return "blocked";
  return "done"; // posted, reversed
}

function stateTone(s: Row["state"]): "success" | "info" | "warning" | "danger" | "neutral" {
  if (s === "posted") return "success";
  if (s === "approved") return "info";
  if (s === "submitted") return "warning";
  if (s === "rejected") return "danger";
  return "neutral";
}

function money(cents: number, ccy: string): string {
  try {
    return (cents / 100).toLocaleString(undefined, { style: "currency", currency: ccy });
  } catch {
    return `${ccy} ${(cents / 100).toFixed(2)}`;
  }
}

function progressFor(state: Row["state"]): number {
  if (state === "draft") return 10;
  if (state === "submitted") return 35;
  if (state === "approved") return 70;
  if (state === "posted") return 100;
  if (state === "rejected") return 0;
  return 0;
}

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

const Toolbar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const DesktopNew = styled.div`
  display: none;
  ${amMedia.lg} {
    display: flex;
    justify-content: flex-end;
  }
`;

const Fab = styled.button`
  position: fixed;
  right: 16px;
  bottom: calc(80px + env(safe-area-inset-bottom));
  width: 56px;
  height: 56px;
  border-radius: var(--am-radius-pill);
  background: var(--am-brand-600);
  color: var(--am-ink-on-brand);
  border: 0;
  box-shadow: var(--am-shadow-3);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  z-index: var(--am-z-sticky);
  ${amMedia.lg} {
    display: none;
  }
`;

const RowCard = styled.div`
  background: var(--am-surface);
  border: 0;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: pointer;
  text-align: left;
  width: 100%;
  & + & {
    border-top: 1px solid var(--am-border);
  }
  &:hover {
    background: var(--am-bg-soft);
  }
  &:focus-visible {
    outline: 2px solid var(--am-brand-500);
    outline-offset: -2px;
  }
`;

const RowTop = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
`;

const RowMain = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const RowTitle = styled.div`
  font-weight: 600;
  font-size: 15px;
  color: var(--am-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const RowMeta = styled.div`
  font-size: 12px;
  color: var(--am-ink-muted);
`;

const DuePill = styled.span<{ $overdue: boolean }>`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--am-radius-pill);
  font-size: 12px;
  font-weight: 600;
  background: ${({ $overdue }) => ($overdue ? "var(--am-danger-50)" : "var(--am-bg-soft)")};
  color: ${({ $overdue }) => ($overdue ? "var(--am-danger-700, #991b1b)" : "var(--am-ink-muted)")};
`;

const Bar = styled.div<{ $pct: number; $state: Row["state"] }>`
  height: 4px;
  width: 100%;
  background: var(--am-bg-soft);
  border-radius: var(--am-radius-pill);
  position: relative;
  overflow: hidden;
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    width: ${({ $pct }) => Math.max(0, Math.min(100, $pct))}%;
    background: ${({ $state }) =>
      $state === "rejected"
        ? "var(--am-danger-600)"
        : $state === "posted"
          ? "var(--am-success-600)"
          : "var(--am-brand-600)"};
    border-radius: inherit;
    transition: width var(--am-dur-base) var(--am-ease-standard);
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
  font: inherit;
`;

const Select = styled.select`
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

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
`;

const DetailSection = styled.div`
  background: var(--am-surface);
  padding: 12px;
  border-radius: var(--am-radius-md);
  border: 1px solid var(--am-border);
  h3 {
    margin: 0 0 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--am-ink-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
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

const DetailBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Actions = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

function MobileProduction() {
  const toast = useAdminToast();
  const [me, setMe] = useState<Me | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [bucket, setBucket] = useState<Bucket>("open");
  const [query, setQuery] = useState("");
  const [assignee, setAssignee] = useState<"all" | "me">("all");
  const [initialised, setInitialised] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<Row | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [confirmReject, setConfirmReject] = useState<Row | null>(null);

  // Default "Me" filter for field_member when `me` resolves.
  useEffect(() => {
    void api<Me>("/me")
      .then((m) => {
        setMe(m);
        const isField = m.assignments.some((a) => a.role === "field_member");
        setAssignee(isField ? "me" : "all");
        setInitialised(true);
      })
      .catch(() => setInitialised(true));
  }, []);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [prod, biz] = await Promise.all([
        api<Row[]>("/admin/businesses/production/list"),
        api<Business[]>("/admin/businesses/"),
      ]);
      setRows(prod);
      setBusinesses(biz.map((b) => ({ id: b.id, name: b.name })));
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Could not load production.");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    if (initialised) void load();
  }, [load, initialised]);

  const businessName = useCallback(
    (id: string) => businesses.find((b) => b.id === id)?.name ?? id.slice(-6),
    [businesses]
  );

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = query.trim().toLowerCase();
    const myId = me?.user?.id ?? null;
    return rows.filter((r) => {
      if (bucketOf(r.state) !== bucket) return false;
      if (assignee === "me" && myId && r.submitted_by !== myId) return false;
      if (!q) return true;
      const biz = businessName(r.business_id).toLowerCase();
      return (
        r.caption.toLowerCase().includes(q) ||
        biz.includes(q) ||
        r.unit.toLowerCase().includes(q)
      );
    });
  }, [rows, bucket, assignee, query, me, businessName]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { open: 0, progress: 0, blocked: 0, done: 0 };
    for (const r of rows ?? []) m[bucketOf(r.state)] += 1;
    return m;
  }, [rows]);

  async function approve(r: Row) {
    try {
      await api(`/admin/businesses/production/${r.id}/approve`, { json: {} });
      toast.push({ tone: "success", message: "Approved — posted to ledger." });
      setDetail(null);
      await load();
    } catch (e) {
      toast.push({
        tone: "danger",
        message: e instanceof ApiClientError ? e.message : "Failed.",
      });
    }
  }

  async function reject(r: Row, reason: string) {
    try {
      await api(`/admin/businesses/production/${r.id}/reject`, { json: { reason } });
      toast.push({ tone: "warning", message: "Rejected." });
      setConfirmReject(null);
      setDetail(null);
      setRejectReason("");
      await load();
    } catch (e) {
      toast.push({
        tone: "danger",
        message: e instanceof ApiClientError ? e.message : "Failed.",
      });
    }
  }

  const isOverdue = (dueOn?: string | null) => {
    if (!dueOn) return false;
    const due = Date.parse(dueOn);
    return Number.isFinite(due) && due < Date.now();
  };

  return (
    <Page>
      <PageTitle>Production</PageTitle>

      <Toolbar>
        <SegmentedControl
          label="State bucket"
          options={BUCKETS.map((b) => ({
            value: b.value,
            label: b.label,
            count: counts[b.value],
          }))}
          value={bucket}
          onChange={(v) => setBucket(v)}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <SearchField
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClear={() => setQuery("")}
              placeholder="Search caption, business"
            />
          </div>
          <Select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value as "all" | "me")}
            aria-label="Assignee filter"
            style={{ maxWidth: 120 }}
          >
            <option value="all">All</option>
            <option value="me">Me</option>
          </Select>
        </div>
        <DesktopNew>
          <Button onClick={() => setCreateOpen(true)}>+ New record</Button>
        </DesktopNew>
      </Toolbar>

      {err && (
        <Banner
          tone="danger"
          title="Couldn't load production"
          action={
            <Button variant="ghost" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          }
        >
          {err}
        </Banner>
      )}

      {rows === null ? (
        <Card padding="none">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                padding: 14,
                borderTop: i === 0 ? 0 : "1px solid var(--am-border)",
              }}
            >
              <Skeleton height={14} width="55%" />
              <div style={{ height: 6 }} />
              <Skeleton height={10} width="30%" />
            </div>
          ))}
        </Card>
      ) : filtered && filtered.length === 0 ? (
        <Card padding="none">
          <EmptyState
            title={rows.length === 0 ? "No production yet" : "Nothing here"}
            description={
              rows.length === 0
                ? "Submit a production record to kick off the approval workflow."
                : "Try another filter or bucket."
            }
            action={
              rows.length === 0 ? (
                <Button onClick={() => setCreateOpen(true)}>+ New record</Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <Card padding="none">
          {filtered!.map((r) => {
            const overdue = isOverdue(r.due_on);
            const pct = progressFor(r.state);
            return (
              <RowCard
                key={r.id}
                as="button"
                type="button"
                onClick={() => setDetail(r)}
              >
                <RowTop>
                  <RowMain>
                    <RowTitle>
                      {r.caption || `${r.quantity} ${r.unit} · ${businessName(r.business_id)}`}
                    </RowTitle>
                    <RowMeta>
                      {businessName(r.business_id)} ·{" "}
                      {new Date(r.occurred_on).toLocaleDateString()} ·{" "}
                      {money(r.gross_source_cents, r.source_currency)}
                    </RowMeta>
                  </RowMain>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                    {r.due_on ? (
                      <DuePill $overdue={overdue}>
                        {overdue ? "Overdue" : "Due"} {new Date(r.due_on).toLocaleDateString()}
                      </DuePill>
                    ) : null}
                    <Badge tone={stateTone(r.state)}>{r.state}</Badge>
                  </div>
                </RowTop>
                <Bar
                  $pct={pct}
                  $state={r.state}
                  aria-label={`${r.state} — ${pct}%`}
                />
              </RowCard>
            );
          })}
        </Card>
      )}

      <Fab type="button" aria-label="Submit production" onClick={() => setCreateOpen(true)}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </Fab>

      <SubmitSheet
        open={createOpen}
        businesses={businesses}
        onClose={() => setCreateOpen(false)}
        onDone={async () => {
          setCreateOpen(false);
          toast.push({ tone: "success", message: "Submitted for approval." });
          await load();
        }}
      />

      <Sheet
        open={!!detail}
        onClose={() => setDetail(null)}
        variant="full"
        title={detail ? detail.caption || `${detail.quantity} ${detail.unit}` : ""}
        description={
          detail
            ? `${businessName(detail.business_id)} · ${new Date(detail.occurred_on).toLocaleDateString()}`
            : undefined
        }
      >
        {detail && (
          <DetailBody>
            <DetailSection>
              <h3>Overview</h3>
              <dl>
                <dt>State</dt>
                <dd>
                  <Badge tone={stateTone(detail.state)}>{detail.state}</Badge>
                </dd>
                <dt>Quantity</dt>
                <dd>
                  {detail.quantity} {detail.unit}
                </dd>
                <dt>Gross</dt>
                <dd>{money(detail.gross_source_cents, detail.source_currency)}</dd>
                {detail.gross_base_cents ? (
                  <>
                    <dt>In base</dt>
                    <dd>{money(detail.gross_base_cents, "USD")}</dd>
                  </>
                ) : null}
                <dt>Occurred</dt>
                <dd>{new Date(detail.occurred_on).toLocaleDateString()}</dd>
              </dl>
            </DetailSection>
            {detail.caption ? (
              <DetailSection>
                <h3>Caption</h3>
                <p style={{ margin: 0 }}>{detail.caption}</p>
              </DetailSection>
            ) : null}
            {detail.rejected_reason ? (
              <DetailSection>
                <h3>Rejection reason</h3>
                <p style={{ margin: 0, color: "var(--am-danger-700, #991b1b)" }}>
                  {detail.rejected_reason}
                </p>
              </DetailSection>
            ) : null}
            {detail.state === "submitted" ? (
              <Actions>
                <Button variant="primary" onClick={() => approve(detail)}>
                  Approve &amp; post
                </Button>
                <Button variant="danger" onClick={() => setConfirmReject(detail)}>
                  Reject
                </Button>
              </Actions>
            ) : null}
          </DetailBody>
        )}
      </Sheet>

      {/* Reject reason sheet */}
      <Sheet
        open={!!confirmReject}
        onClose={() => {
          setConfirmReject(null);
          setRejectReason("");
        }}
        title="Reject production"
        description="Explain why so the submitter can correct the record."
        footer={
          <>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setConfirmReject(null);
                setRejectReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              fullWidth
              variant="danger"
              onClick={() =>
                confirmReject && rejectReason.trim() && reject(confirmReject, rejectReason.trim())
              }
              disabled={!rejectReason.trim()}
            >
              Reject
            </Button>
          </>
        }
      >
        <Field>
          <span>Reason</span>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Quantity doesn't match the delivery note."
            maxLength={1000}
            autoFocus
          />
        </Field>
      </Sheet>
    </Page>
  );
}

type SubmitSheetProps = {
  open: boolean;
  businesses: Business[];
  onClose: () => void;
  onDone: () => void;
};

function SubmitSheet({ open, businesses, onClose, onDone }: SubmitSheetProps) {
  const toast = useAdminToast();
  const [businessId, setBusinessId] = useState(businesses[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("unit");
  const [currency, setCurrency] = useState("USD");
  const [gross, setGross] = useState(1);
  const [occurredOn, setOccurredOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [caption, setCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!businessId && businesses[0]) setBusinessId(businesses[0].id);
  }, [businesses, businessId]);

  async function submit() {
    if (!businessId) {
      toast.push({ tone: "danger", message: "Create a business first." });
      return;
    }
    setSubmitting(true);
    try {
      await api("/admin/businesses/production", {
        json: {
          business_id: businessId,
          caption,
          quantity,
          unit,
          source_currency: currency.toUpperCase(),
          gross_source_cents: Math.round(gross * 100),
          occurred_on: new Date(occurredOn).toISOString(),
        },
      });
      onDone();
    } catch (e) {
      toast.push({
        tone: "danger",
        message: e instanceof ApiClientError ? e.message : "Submit failed.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title="Submit production"
      description="Approved records post immediately to the ledger."
      dismissible={!submitting}
      footer={
        <>
          <Button variant="secondary" fullWidth onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            fullWidth
            loading={submitting}
            onClick={submit}
            disabled={!businessId || gross <= 0 || quantity <= 0}
          >
            Submit
          </Button>
        </>
      }
    >
      <FormGrid>
        <Field>
          <span>Business</span>
          <Select value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <span>Quantity &amp; unit</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 8 }}>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
            <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
              {["kg", "g", "l", "ml", "unit", "pack", "dozen", "hour", "other"].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </Select>
          </div>
        </Field>
        <Field>
          <span>Gross (source currency)</span>
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 8 }}>
            <Input
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              maxLength={3}
              autoCapitalize="characters"
            />
            <Input
              type="number"
              min={0.01}
              step="0.01"
              value={gross}
              onChange={(e) => setGross(Number(e.target.value))}
            />
          </div>
        </Field>
        <Field>
          <span>Occurred on</span>
          <Input
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            required
          />
        </Field>
        <Field>
          <span>Caption (public, 500 chars)</span>
          <Input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={500}
          />
        </Field>
      </FormGrid>
    </Sheet>
  );
}

/* ================================================================= */
/* Legacy fallback                                                    */
/* ================================================================= */

const LegacyHeader = styled.div`
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

const LegacyField = styled.label`
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

function legacyTone(state: Row["state"]) {
  switch (state) {
    case "posted":
      return "success" as const;
    case "approved":
      return "info" as const;
    case "submitted":
      return "warning" as const;
    case "rejected":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

function LegacyProduction() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [prod, biz] = await Promise.all([
        api<Row[]>("/admin/businesses/production/list"),
        api<Business[]>("/admin/businesses/"),
      ]);
      setRows(prod);
      setBusinesses(biz.map((b) => ({ id: b.id, name: b.name })));
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Could not load production.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve(id: string) {
    try {
      await api(`/admin/businesses/production/${id}/approve`, { json: {} });
      toast.push({ tone: "success", message: "Approved — posted to ledger." });
      await load();
    } catch (e) {
      toast.push({ tone: "danger", message: e instanceof ApiClientError ? e.message : "Failed." });
    }
  }

  async function reject(id: string) {
    const reason = window.prompt("Reason for rejection");
    if (!reason) return;
    try {
      await api(`/admin/businesses/production/${id}/reject`, { json: { reason } });
      toast.push({ tone: "warning", message: "Rejected." });
      await load();
    } catch (e) {
      toast.push({ tone: "danger", message: e instanceof ApiClientError ? e.message : "Failed." });
    }
  }

  const businessName = (id: string) => businesses.find((b) => b.id === id)?.name ?? id.slice(-6);

  const columns: Column<Row>[] = [
    { key: "when", header: "Occurred", render: (r) => new Date(r.occurred_on).toLocaleDateString() },
    { key: "biz", header: "Business", render: (r) => businessName(r.business_id) },
    { key: "qty", header: "Qty", render: (r) => `${r.quantity} ${r.unit}` },
    {
      key: "gross",
      header: "Gross",
      align: "right",
      render: (r) => money(r.gross_source_cents, r.source_currency),
    },
    {
      key: "state",
      header: "State",
      render: (r) => <StatusBadge tone={legacyTone(r.state)}>{r.state}</StatusBadge>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) =>
        r.state === "submitted" ? (
          <>
            <LegacyButton onClick={() => approve(r.id)}>Approve &amp; post</LegacyButton>
            <LegacyButton onClick={() => reject(r.id)} variant="ghost">
              Reject
            </LegacyButton>
          </>
        ) : null,
    },
  ];

  return (
    <div>
      <LegacyHeader>
        <h2>Production queue</h2>
        <LegacyButton onClick={() => setOpen(true)}>Submit production</LegacyButton>
      </LegacyHeader>
      {err ? (
        <ErrorState message={err} retry={load} />
      ) : rows === null ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <LegacyEmpty title="No production yet" />
      ) : (
        <DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} />
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Submit production">
        <LegacySubmit
          businesses={businesses}
          onDone={async () => {
            setOpen(false);
            await load();
            toast.push({ tone: "success", message: "Submitted for approval." });
          }}
        />
      </Dialog>
    </div>
  );
}

function LegacySubmit({ businesses, onDone }: { businesses: Business[]; onDone: () => void }) {
  const [businessId, setBusinessId] = useState(businesses[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("unit");
  const [currency, setCurrency] = useState("USD");
  const [gross, setGross] = useState(1);
  const [occurredOn, setOccurredOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!businessId) return setErr("Create a business first.");
    setLoading(true);
    try {
      await api("/admin/businesses/production", {
        json: {
          business_id: businessId,
          caption,
          quantity,
          unit,
          source_currency: currency.toUpperCase(),
          gross_source_cents: Math.round(gross * 100),
          occurred_on: new Date(occurredOn).toISOString(),
        },
      });
      onDone();
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Could not submit.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <LegacyField>
        <span>Business</span>
        <select value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </LegacyField>
      <LegacyField>
        <span>Quantity &amp; unit</span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 8 }}>
          <input
            type="number"
            min={0}
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
          <select value={unit} onChange={(e) => setUnit(e.target.value)}>
            {["kg", "g", "l", "ml", "unit", "pack", "dozen", "hour", "other"].map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </div>
      </LegacyField>
      <LegacyField>
        <span>Gross (source currency)</span>
        <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 8 }}>
          <input
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            maxLength={3}
          />
          <input
            type="number"
            min={0.01}
            step="0.01"
            value={gross}
            onChange={(e) => setGross(Number(e.target.value))}
          />
        </div>
      </LegacyField>
      <LegacyField>
        <span>Occurred on</span>
        <input
          type="date"
          value={occurredOn}
          onChange={(e) => setOccurredOn(e.target.value)}
          required
        />
      </LegacyField>
      <LegacyField>
        <span>Caption (public, 500 chars)</span>
        <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={500} />
      </LegacyField>
      {err ? <p role="alert" style={{ color: "#b91c1c" }}>{err}</p> : null}
      <LegacyButton type="submit" loading={loading} full>
        {loading ? "Submitting…" : "Submit"}
      </LegacyButton>
    </form>
  );
}
