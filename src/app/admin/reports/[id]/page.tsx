"use client";

import { use, useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { Button } from "@/components/ui/Button";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { api, ApiClientError } from "@/lib/api";

export const dynamic = "force-dynamic";

type Snapshot = {
  period_code: string;
  content_hash: string;
  compiler_version: string;
  totals: { projects: number; communities: number; accomplishments: number; businesses: number };
  finance: {
    base_currency: string;
    donations_received_base_cents: number;
    operating_expenses_base_cents: number;
    programme_expenses_base_cents: number;
    business_revenue_base_cents: number;
    sustainability_ratio: number;
  };
};

type Report = {
  id: string;
  period_kind: "month" | "quarter" | "year";
  period_code: string;
  title: string;
  state: string;
  summary: string;
  body_markdown: string;
  selected_accomplishment_public_ids: string[];
  snapshot: Snapshot | null;
  version: number;
};

const Head = styled.header`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  h2 {
    font-family: ${({ theme }) => theme.font.heading};
    color: ${({ theme }) => theme.colors.trustBlue};
    margin: 0;
    font-size: 1.6rem;
  }
`;

const Grid = styled.div`
  display: grid;
  gap: 1.25rem;
  @media (min-width: 960px) {
    grid-template-columns: 1.4fr 1fr;
  }
`;

const Card = styled.section`
  background: #fff;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  padding: 1.25rem 1.5rem;
`;

const Field = styled.label`
  display: grid;
  gap: 0.3rem;
  margin-bottom: 0.9rem;
  span {
    font-size: 0.82rem;
    font-weight: 600;
  }
  input,
  textarea {
    padding: 0.6rem 0.8rem;
    border-radius: ${({ theme }) => theme.radius.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    font: inherit;
  }
  textarea {
    min-height: 180px;
    font-family: inherit;
    line-height: 1.5;
  }
`;

const KV = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.3rem 1rem;
  margin-top: 0.75rem;
  dt {
    color: ${({ theme }) => theme.colors.inkMuted};
    font-size: 0.82rem;
  }
  dd {
    margin: 0;
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-size: 0.92rem;
  }
`;

function money(cents: number, ccy: string): string {
  try {
    return (cents / 100).toLocaleString(undefined, { style: "currency", currency: ccy });
  } catch {
    return `${ccy} ${(cents / 100).toFixed(2)}`;
  }
}

export default function ReportEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const [report, setReport] = useState<Report | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [accs, setAccs] = useState("");

  const load = useCallback(async () => {
    setErr(null);
    try {
      const r = await api<Report>(`/admin/reports/${id}`);
      setReport(r);
      setTitle(r.title);
      setSummary(r.summary);
      setBody(r.body_markdown);
      setAccs(r.selected_accomplishment_public_ids.join("\n"));
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Could not load report.");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!report) return;
    try {
      await api(`/admin/reports/${report.id}`, {
        method: "PATCH",
        json: {
          title,
          summary,
          body_markdown: body,
          selected_accomplishment_public_ids: accs
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          version: report.version,
        },
      });
      toast.push({ tone: "success", message: "Saved. State reset to draft; recompile when ready." });
      await load();
    } catch (e) {
      toast.push({ tone: "danger", message: e instanceof ApiClientError ? e.message : "Save failed." });
    }
  }

  async function compile() {
    if (!report) return;
    try {
      await api(`/admin/reports/${report.id}/compile`, { json: {} });
      toast.push({ tone: "success", message: "Compiled a fresh snapshot." });
      await load();
    } catch (e) {
      toast.push({ tone: "danger", message: e instanceof ApiClientError ? e.message : "Compile failed." });
    }
  }

  if (err) return <ErrorState message={err} retry={load} />;
  if (!report) return <LoadingState />;

  return (
    <div>
      <Head>
        <div>
          <h2>{report.title}</h2>
          <p style={{ color: "#6b7280", margin: 0 }}>
            {report.period_kind} · {report.period_code} · <StatusBadge tone="info">{report.state}</StatusBadge>
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Button onClick={save}>Save editorial</Button>
          <Button onClick={compile} variant="secondary">
            Recompile numbers
          </Button>
        </div>
      </Head>

      <Grid>
        <Card>
          <h3 style={{ marginTop: 0 }}>Editorial</h3>
          <Field>
            <span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </Field>
          <Field>
            <span>Summary (max 2000 chars — shown at the top of the PDF)</span>
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={2000} />
          </Field>
          <Field>
            <span>Body (markdown — paragraphs separated by blank lines)</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={50_000} rows={14} />
          </Field>
          <Field>
            <span>Highlighted accomplishments (one public id per line)</span>
            <textarea value={accs} onChange={(e) => setAccs(e.target.value)} rows={5} />
          </Field>
        </Card>

        <Card>
          <h3 style={{ marginTop: 0 }}>Snapshot (frozen numbers)</h3>
          {report.snapshot ? (
            <>
              <p style={{ margin: 0 }}>
                Content hash: <code>{report.snapshot.content_hash.slice(0, 20)}…</code>
                <br />
                Compiler: <code>{report.snapshot.compiler_version}</code>
              </p>
              <KV>
                <dt>Projects</dt>
                <dd>{report.snapshot.totals.projects}</dd>
                <dt>Communities</dt>
                <dd>{report.snapshot.totals.communities}</dd>
                <dt>Accomplishments</dt>
                <dd>{report.snapshot.totals.accomplishments}</dd>
                <dt>Businesses</dt>
                <dd>{report.snapshot.totals.businesses}</dd>
                <dt>Donations received</dt>
                <dd>{money(report.snapshot.finance.donations_received_base_cents, report.snapshot.finance.base_currency)}</dd>
                <dt>Operating expenses</dt>
                <dd>{money(report.snapshot.finance.operating_expenses_base_cents, report.snapshot.finance.base_currency)}</dd>
                <dt>Programme expenses</dt>
                <dd>{money(report.snapshot.finance.programme_expenses_base_cents, report.snapshot.finance.base_currency)}</dd>
                <dt>Business revenue</dt>
                <dd>{money(report.snapshot.finance.business_revenue_base_cents, report.snapshot.finance.base_currency)}</dd>
                <dt>Sustainability</dt>
                <dd>{(report.snapshot.finance.sustainability_ratio * 100).toFixed(0)}%</dd>
              </KV>
            </>
          ) : (
            <p style={{ color: "#6b7280" }}>
              No snapshot yet — compile to freeze the numbers for this period.
            </p>
          )}
        </Card>
      </Grid>
    </div>
  );
}
