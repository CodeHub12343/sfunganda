"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import NextLink from "next/link";
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
  FilterChip,
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
  period_kind: "month" | "quarter" | "year";
  period_code: string;
  title: string;
  category?: "financial" | "impact" | "compliance" | "custom";
  summary?: string;
  state:
    | "draft"
    | "compiled"
    | "finance_signed"
    | "approved"
    | "published"
    | "archived"
    | "changes_requested";
  snapshot_content_hash: string | null;
  finance_signed_at: string | null;
  approved_at: string | null;
  published_at: string | null;
  latest_export_id: string | null;
  size_bytes?: number | null;
  generated_at?: string | null;
};

export default function AdminReports() {
  const mobile = useFlag("admin.mobileShell");
  return mobile ? <MobileReports /> : <LegacyReports />;
}

/* ================================================================= */
/* Mobile                                                             */
/* ================================================================= */

const CATEGORIES = [
  { value: "all" as const, label: "All" },
  { value: "financial" as const, label: "Financial" },
  { value: "impact" as const, label: "Impact" },
  { value: "compliance" as const, label: "Compliance" },
  { value: "custom" as const, label: "Custom" },
];
type Category = (typeof CATEGORIES)[number]["value"];

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

const Chips = styled.div`
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  ${amMedia.md} {
    grid-template-columns: 1fr 1fr;
  }
  ${amMedia.lg} {
    grid-template-columns: 1fr 1fr 1fr;
  }
`;

const ReportCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const CardHead = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: flex-start;
`;

const CardTitle = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--am-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  a {
    color: inherit;
    text-decoration: none;
  }
  a:hover {
    text-decoration: underline;
  }
`;

const CardPeriod = styled.div`
  font-size: 12px;
  color: var(--am-ink-muted);
  text-transform: capitalize;
`;

const CardFoot = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--am-ink-muted);
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

const DesktopNew = styled.div`
  display: none;
  ${amMedia.lg} {
    display: flex;
    justify-content: flex-end;
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

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
`;

const FormatRow = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 12px;
  border-radius: var(--am-radius-md);
  background: var(--am-surface);
  color: var(--am-ink);
  border: 1px solid var(--am-border);
  cursor: pointer;
  text-align: left;
  &:hover {
    background: var(--am-bg-soft);
  }
  &:focus-visible {
    outline: 2px solid var(--am-brand-500);
    outline-offset: 2px;
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const FormatIcon = styled.span`
  width: 36px;
  height: 36px;
  border-radius: var(--am-radius-sm);
  background: var(--am-brand-50);
  color: var(--am-brand-600);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
`;

const PreviewBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const PreviewHero = styled.div`
  background: var(--am-brand-50);
  padding: 16px;
  border-radius: var(--am-radius-md);
  display: flex;
  flex-direction: column;
  gap: 4px;
  h3 {
    margin: 0;
    font-size: 18px;
    color: var(--am-ink);
  }
  small {
    color: var(--am-ink-muted);
    text-transform: capitalize;
  }
`;

const Actions = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

function tone(state: Row["state"]): "success" | "info" | "warning" | "danger" | "neutral" {
  switch (state) {
    case "published":
      return "success";
    case "approved":
    case "finance_signed":
      return "info";
    case "compiled":
      return "warning";
    case "changes_requested":
      return "danger";
    case "archived":
      return "neutral";
    default:
      return "neutral";
  }
}

function categoryOf(r: Row): Exclude<Category, "all"> {
  if (r.category) return r.category;
  // Heuristic fallback.
  const t = `${r.title}`.toLowerCase();
  if (t.includes("compliance") || t.includes("audit") || t.includes("legal")) return "compliance";
  if (t.includes("impact") || t.includes("program")) return "impact";
  if (t.includes("finance") || t.includes("budget") || t.includes("ledger")) return "financial";
  return "custom";
}

function stateLabel(s: Row["state"]): "Ready" | "Generating" | "Failed" {
  if (s === "published") return "Ready";
  if (s === "changes_requested") return "Failed";
  return "Generating";
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

type Format = "pdf" | "csv" | "xlsx";

async function openOrShare(url: string, filename: string, toastFn: (msg: string) => void) {
  // Try native share on iOS where downloading a .csv or .xlsx can be awkward.
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  };
  try {
    if (nav.share && /iPhone|iPad|iPod/.test(nav.userAgent)) {
      await nav.share({ url, title: filename });
      return;
    }
  } catch {
    // user cancelled or share failed — fall through to anchor download.
  }
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  a.remove();
  toastFn("Download started");
}

function MobileReports() {
  const toast = useAdminToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [range, setRange] = useState<"all" | "ytd" | "last90" | "last30">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [preview, setPreview] = useState<Row | null>(null);
  const [downloadOpen, setDownloadOpen] = useState<Row | null>(null);
  const [downloading, setDownloading] = useState<Format | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const data = await api<Row[]>("/admin/reports/");
      setRows(data);
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Could not load reports.");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = query.trim().toLowerCase();
    const now = Date.now();
    const cutoff =
      range === "last30"
        ? now - 30 * 86400_000
        : range === "last90"
          ? now - 90 * 86400_000
          : range === "ytd"
            ? Date.UTC(new Date().getUTCFullYear(), 0, 1)
            : 0;
    return rows.filter((r) => {
      if (category !== "all" && categoryOf(r) !== category) return false;
      if (cutoff > 0) {
        const t = r.generated_at
          ? Date.parse(r.generated_at)
          : r.published_at
            ? Date.parse(r.published_at)
            : null;
        if (!t || t < cutoff) return false;
      }
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.period_code.toLowerCase().includes(q) ||
        r.period_kind.toLowerCase().includes(q)
      );
    });
  }, [rows, query, category, range]);

  async function doAction(r: Row, action: string, successMsg: string) {
    try {
      await api(`/admin/reports/${r.id}/${action}`, { json: {} });
      toast.push({ tone: "success", message: successMsg });
      await load();
    } catch (e) {
      toast.push({
        tone: "danger",
        message: e instanceof ApiClientError ? e.message : "Failed.",
      });
    }
  }

  async function requestDownload(r: Row, format: Format) {
    setDownloading(format);
    try {
      const resp = await api<{ url?: string; export_id?: string }>(
        `/admin/reports/${r.id}/export`,
        { json: { format } }
      );
      if (resp.url) {
        await openOrShare(
          resp.url,
          `${r.title.replace(/[^\w-]+/g, "_")}-${r.period_code}.${format}`,
          (m) => toast.push({ tone: "info", message: m })
        );
      } else {
        toast.push({
          tone: "info",
          message: `${format.toUpperCase()} export queued — you'll get a link when ready.`,
        });
      }
    } catch (e) {
      toast.push({
        tone: "danger",
        message: e instanceof ApiClientError ? e.message : "Export failed.",
      });
    } finally {
      setDownloading(null);
      setDownloadOpen(null);
    }
  }

  return (
    <Page>
      <PageTitle>Reports</PageTitle>

      <Toolbar>
        <SegmentedControl
          label="Category"
          options={CATEGORIES.filter((c) => c.value !== "all").map((c) => ({
            value: c.value,
            label: c.label,
          }))}
          // Treat the mobile tabs as narrower than the five categories — "all" uses the chip row below.
          value={category === "all" ? "financial" : (category as Exclude<Category, "all">)}
          onChange={(v) => setCategory(v)}
        />
        <SearchField
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
          placeholder="Search title, period"
        />
        <Chips>
          <FilterChip active={range === "all"} onClick={() => setRange("all")}>
            All time
          </FilterChip>
          <FilterChip active={range === "ytd"} onClick={() => setRange("ytd")}>
            Year to date
          </FilterChip>
          <FilterChip active={range === "last90"} onClick={() => setRange("last90")}>
            Last 90 days
          </FilterChip>
          <FilterChip active={range === "last30"} onClick={() => setRange("last30")}>
            Last 30 days
          </FilterChip>
          <FilterChip
            active={category === "all"}
            onClick={() => setCategory("all")}
          >
            All categories
          </FilterChip>
        </Chips>
        <DesktopNew>
          <Button onClick={() => setCreateOpen(true)}>+ New report</Button>
        </DesktopNew>
      </Toolbar>

      {err && (
        <Banner
          tone="danger"
          title="Couldn't load reports"
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
        <Grid>
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <Skeleton height={18} width="70%" />
              <div style={{ height: 10 }} />
              <Skeleton height={12} width="40%" />
              <div style={{ height: 16 }} />
              <Skeleton height={6} />
            </Card>
          ))}
        </Grid>
      ) : filtered && filtered.length === 0 ? (
        <Card padding="none">
          <EmptyState
            title={rows.length === 0 ? "No reports yet" : "No matches"}
            description={
              rows.length === 0
                ? "Start a new monthly or quarterly report."
                : "Try a different category, range, or search."
            }
            action={
              rows.length === 0 ? (
                <Button onClick={() => setCreateOpen(true)}>+ New report</Button>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setQuery("");
                    setCategory("all");
                    setRange("all");
                  }}
                >
                  Clear filters
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <Grid>
          {filtered!.map((r) => {
            const label = stateLabel(r.state);
            return (
              <ReportCard key={r.id} variant="default">
                <CardHead>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <CardTitle>
                      <NextLink href={`/admin/reports/${r.id}`}>{r.title}</NextLink>
                    </CardTitle>
                    <CardPeriod>
                      {r.period_kind} · {r.period_code}
                    </CardPeriod>
                  </div>
                  <Badge tone={tone(r.state)}>{r.state.replace("_", " ")}</Badge>
                </CardHead>
                <CardFoot>
                  <span>
                    {r.generated_at
                      ? `Generated ${new Date(r.generated_at).toLocaleDateString()}`
                      : r.published_at
                        ? `Published ${new Date(r.published_at).toLocaleDateString()}`
                        : "Not generated"}
                    {r.size_bytes ? ` · ${formatBytes(r.size_bytes)}` : ""}
                  </span>
                  <Badge
                    tone={label === "Ready" ? "success" : label === "Failed" ? "danger" : "warning"}
                  >
                    {label}
                  </Badge>
                </CardFoot>
                <Actions>
                  <Button size="sm" variant="secondary" onClick={() => setPreview(r)}>
                    Preview
                  </Button>
                  {r.state !== "draft" ? (
                    <Button size="sm" onClick={() => setDownloadOpen(r)}>
                      Download
                    </Button>
                  ) : null}
                </Actions>
              </ReportCard>
            );
          })}
        </Grid>
      )}

      <Fab type="button" aria-label="Generate report" onClick={() => setCreateOpen(true)}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </Fab>

      <CreateSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onDone={async () => {
          setCreateOpen(false);
          toast.push({ tone: "success", message: "Report drafted." });
          await load();
        }}
      />

      <Sheet
        open={!!preview}
        onClose={() => setPreview(null)}
        variant="full"
        title={preview?.title ?? ""}
        description={
          preview ? `${preview.period_kind} · ${preview.period_code}` : undefined
        }
      >
        {preview && (
          <PreviewBody>
            <PreviewHero>
              <h3>{preview.title}</h3>
              <small>
                {preview.period_kind} · {preview.period_code} ·{" "}
                <Badge tone={tone(preview.state)}>{preview.state.replace("_", " ")}</Badge>
              </small>
            </PreviewHero>
            {preview.summary ? (
              <p style={{ margin: 0, color: "var(--am-ink)" }}>{preview.summary}</p>
            ) : (
              <p style={{ margin: 0, color: "var(--am-ink-muted)" }}>
                No preview summary yet — compile the report to generate one.
              </p>
            )}
            <Actions>
              <NextLink
                href={`/admin/reports/${preview.id}`}
                style={{ textDecoration: "none" }}
              >
                <Button variant="primary">Open full report</Button>
              </NextLink>
              {preview.state !== "draft" ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    const r = preview;
                    setPreview(null);
                    setDownloadOpen(r);
                  }}
                >
                  Download…
                </Button>
              ) : null}
              {(preview.state === "draft" ||
                preview.state === "compiled" ||
                preview.state === "finance_signed") && (
                <Button
                  variant="ghost"
                  onClick={() => doAction(preview, "compile", "Recompiled.")}
                >
                  Recompile
                </Button>
              )}
              {preview.state === "compiled" && (
                <Button
                  variant="ghost"
                  onClick={() => doAction(preview, "sign-finance", "Finance signed.")}
                >
                  Finance sign
                </Button>
              )}
              {preview.state === "finance_signed" && (
                <Button
                  variant="ghost"
                  onClick={() => doAction(preview, "approve", "Approved.")}
                >
                  Approve
                </Button>
              )}
              {preview.state === "approved" && (
                <Button onClick={() => doAction(preview, "publish", "Published.")}>
                  Publish
                </Button>
              )}
            </Actions>
          </PreviewBody>
        )}
      </Sheet>

      <Sheet
        open={!!downloadOpen}
        onClose={() => (downloading ? undefined : setDownloadOpen(null))}
        title="Download report"
        description="Pick a format."
        dismissible={!downloading}
      >
        <FormGrid>
          <FormatRow
            type="button"
            disabled={!!downloading}
            onClick={() => downloadOpen && requestDownload(downloadOpen, "pdf")}
          >
            <FormatIcon>PDF</FormatIcon>
            <span>
              <div style={{ fontWeight: 600 }}>PDF</div>
              <div style={{ fontSize: 12, color: "var(--am-ink-muted)" }}>
                Printable, with branding. Opens in a share sheet on iOS.
              </div>
            </span>
            {downloading === "pdf" ? <span>…</span> : null}
          </FormatRow>
          <FormatRow
            type="button"
            disabled={!!downloading}
            onClick={() => downloadOpen && requestDownload(downloadOpen, "csv")}
          >
            <FormatIcon>CSV</FormatIcon>
            <span>
              <div style={{ fontWeight: 600 }}>CSV</div>
              <div style={{ fontSize: 12, color: "var(--am-ink-muted)" }}>
                Flat rows for spreadsheets.
              </div>
            </span>
            {downloading === "csv" ? <span>…</span> : null}
          </FormatRow>
          <FormatRow
            type="button"
            disabled={!!downloading}
            onClick={() => downloadOpen && requestDownload(downloadOpen, "xlsx")}
          >
            <FormatIcon>XLSX</FormatIcon>
            <span>
              <div style={{ fontWeight: 600 }}>Excel</div>
              <div style={{ fontSize: 12, color: "var(--am-ink-muted)" }}>
                Multi-tab workbook with formulas.
              </div>
            </span>
            {downloading === "xlsx" ? <span>…</span> : null}
          </FormatRow>
        </FormGrid>
      </Sheet>
    </Page>
  );
}

type CreateProps = { open: boolean; onClose: () => void; onDone: () => void };

function CreateSheet({ open, onClose, onDone }: CreateProps) {
  const toast = useAdminToast();
  const now = new Date();
  const defaultPeriod = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const [kind, setKind] = useState<"month" | "quarter" | "year">("month");
  const [period, setPeriod] = useState(defaultPeriod);
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!period || !title) return;
    setSubmitting(true);
    try {
      await api("/admin/reports/", {
        json: { period_kind: kind, period_code: period, title },
      });
      onDone();
      setTitle("");
    } catch (e) {
      toast.push({
        tone: "danger",
        message: e instanceof ApiClientError ? e.message : "Create failed.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title="New report"
      description="Starts a new draft report for the chosen period."
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
            disabled={!period || !title}
          >
            Create draft
          </Button>
        </>
      }
    >
      <FormGrid>
        <Field>
          <span>Period kind</span>
          <Select value={kind} onChange={(e) => setKind(e.target.value as "month")}>
            <option value="month">Month (YYYY-MM)</option>
            <option value="quarter">Quarter (YYYY-Q#)</option>
            <option value="year">Year (YYYY)</option>
          </Select>
        </Field>
        <Field>
          <span>Period code</span>
          <Input
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="e.g. 2026-03"
          />
        </Field>
        <Field>
          <span>Title</span>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            autoFocus
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
    case "published":
      return "success" as const;
    case "approved":
    case "finance_signed":
      return "info" as const;
    case "compiled":
      return "warning" as const;
    case "archived":
      return "neutral" as const;
    case "changes_requested":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

function LegacyReports() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    setErr(null);
    try {
      const data = await api<Row[]>("/admin/reports/");
      setRows(data);
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Could not load reports.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function doAction(id: string, action: string, successMsg: string) {
    try {
      await api(`/admin/reports/${id}/${action}`, { json: {} });
      toast.push({ tone: "success", message: successMsg });
      await load();
    } catch (e) {
      toast.push({ tone: "danger", message: e instanceof ApiClientError ? e.message : "Failed." });
    }
  }

  const columns: Column<Row>[] = [
    { key: "period", header: "Period", render: (r) => `${r.period_kind} · ${r.period_code}` },
    {
      key: "title",
      header: "Title",
      render: (r) => <NextLink href={`/admin/reports/${r.id}`}>{r.title}</NextLink>,
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
      render: (r) => (
        <>
          {r.state === "draft" || r.state === "compiled" || r.state === "finance_signed" ? (
            <LegacyButton onClick={() => doAction(r.id, "compile", "Recompiled.")} variant="ghost">
              Compile
            </LegacyButton>
          ) : null}
          {r.state === "compiled" ? (
            <LegacyButton onClick={() => doAction(r.id, "sign-finance", "Finance signed.")} variant="secondary">
              Finance sign
            </LegacyButton>
          ) : null}
          {r.state === "finance_signed" ? (
            <LegacyButton onClick={() => doAction(r.id, "approve", "Approved.")} variant="secondary">
              Approve
            </LegacyButton>
          ) : null}
          {r.state === "approved" ? (
            <LegacyButton onClick={() => doAction(r.id, "publish", "Published.")}>Publish</LegacyButton>
          ) : null}
        </>
      ),
    },
  ];

  return (
    <div>
      <LegacyHeader>
        <h2>Reports</h2>
        <LegacyButton onClick={() => setOpen(true)}>New report</LegacyButton>
      </LegacyHeader>
      {err ? (
        <ErrorState message={err} retry={load} />
      ) : rows === null ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <LegacyEmpty title="No reports yet" />
      ) : (
        <DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} />
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="New report">
        <LegacyCreate
          onDone={async () => {
            setOpen(false);
            await load();
            toast.push({ tone: "success", message: "Report drafted." });
          }}
        />
      </Dialog>
    </div>
  );
}

function LegacyCreate({ onDone }: { onDone: () => void }) {
  const now = new Date();
  const defaultPeriod = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const [kind, setKind] = useState<"month" | "quarter" | "year">("month");
  const [period, setPeriod] = useState(defaultPeriod);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await api("/admin/reports/", {
        json: { period_kind: kind, period_code: period, title },
      });
      onDone();
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Could not create.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <LegacyField>
        <span>Period kind</span>
        <select value={kind} onChange={(e) => setKind(e.target.value as "month")}>
          <option value="month">month (YYYY-MM)</option>
          <option value="quarter">quarter (YYYY-Q#)</option>
          <option value="year">year (YYYY)</option>
        </select>
      </LegacyField>
      <LegacyField>
        <span>Period code</span>
        <input required value={period} onChange={(e) => setPeriod(e.target.value)} />
      </LegacyField>
      <LegacyField>
        <span>Title</span>
        <input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
      </LegacyField>
      {err ? <p role="alert" style={{ color: "#b91c1c" }}>{err}</p> : null}
      <LegacyButton type="submit" loading={loading} full>
        {loading ? "Creating…" : "Create draft"}
      </LegacyButton>
    </form>
  );
}
