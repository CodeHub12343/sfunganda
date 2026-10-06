"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { api, ApiClientError } from "@/lib/api";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState as LegacyEmpty, ErrorState, LoadingState } from "@/components/ui/States";
import { useFlag } from "@/lib/flags";
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  FilterChip,
  ListRow,
  SearchField,
  SegmentedControl,
  Skeleton,
  TrendLine,
  amMedia,
} from "@/components/admin-mobile";

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

const STATES = ["draft", "submitted", "approved", "posted", "reversed", "void"] as const;
type TxnState = (typeof STATES)[number] | "all";

type Period = "month" | "quarter" | "year" | "all";

function money(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function periodStart(p: Period): Date | null {
  if (p === "all") return null;
  const now = new Date();
  if (p === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (p === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    return new Date(now.getFullYear(), q * 3, 1);
  }
  return new Date(now.getFullYear(), 0, 1);
}

function stateTone(s: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (s === "posted") return "success";
  if (s === "submitted" || s === "draft") return "warning";
  if (s === "approved") return "info";
  if (s === "reversed" || s === "void") return "danger";
  return "neutral";
}

export default function FinanceDashboard() {
  const mobile = useFlag("admin.mobileShell");
  return mobile ? <MobileFinance /> : <LegacyFinance />;
}

/* ---------------- Mobile ---------------- */

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--am-ink);
`;

const Hero = styled(Card)`
  background: var(--am-grad-trust);
  color: var(--am-ink-on-brand);
  box-shadow: var(--am-shadow-2);
  border: 0;
`;

const HeroLabel = styled.div`
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.85;
`;

const HeroValue = styled.div`
  font-size: 32px;
  font-weight: 800;
  line-height: 40px;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
  margin-top: 2px;
`;

const HeroRow = styled.div`
  display: flex;
  gap: 24px;
  margin-top: 12px;
  font-size: 13px;
`;

const HeroStat = styled.div`
  flex: 1 1 0;
`;

const HeroStatValue = styled.div`
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  margin-top: 2px;
`;

const Funds = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
`;

const FundHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
`;

const FundName = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: var(--am-ink);
`;

const FundSub = styled.div`
  font-size: 11px;
  color: var(--am-ink-subtle);
`;

const FundBalance = styled.div`
  font-size: 18px;
  font-weight: 700;
  color: var(--am-ink);
  font-variant-numeric: tabular-nums;
  margin-top: 6px;
`;

const FundMeta = styled.div`
  font-size: 11px;
  color: var(--am-ink-muted);
  margin-top: 4px;
`;

const SectionHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--am-ink);
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

const List = styled.div`
  background: var(--am-surface);
  border-radius: var(--am-radius-lg);
  overflow: hidden;
  box-shadow: var(--am-shadow-1);

  /* Cheap virtualization for long transaction lists — browser skips rendering
     off-screen rows while reserving space. Keeps 100+ rows at 60 fps. */
  & > * {
    content-visibility: auto;
    contain-intrinsic-size: 68px;
  }
`;

const Amount = styled.span<{ $neg?: boolean }>`
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: ${({ $neg }) => ($neg ? "var(--am-danger-600)" : "var(--am-success-600)")};
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;

  ${amMedia.lg} {
    grid-template-columns: 1fr 1fr;
  }
`;

function MobileFinance() {
  const [funds, setFunds] = useState<Fund[] | null>(null);
  const [txns, setTxns] = useState<Txn[] | null>(null);
  const [period, setPeriod] = useState<Period>("month");
  const [state, setState] = useState<TxnState>("all");
  const [query, setQuery] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    const stateParam = state === "all" ? "" : `?state=${state}`;
    try {
      const [f, t] = await Promise.all([
        api<Fund[]>("/finance/funds"),
        api<{ items: Txn[]; next_cursor: string | null }>(
          `/finance/transactions${stateParam}`
        ),
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

  const filteredTxns = useMemo(() => {
    if (!txns) return null;
    const start = periodStart(period);
    const q = query.trim().toLowerCase();
    return txns.filter((t) => {
      if (start && new Date(t.occurred_on) < start) return false;
      if (!q) return true;
      return (
        t.memo.toLowerCase().includes(q) ||
        (t.public_id ?? "").toLowerCase().includes(q) ||
        t.kind.toLowerCase().includes(q)
      );
    });
  }, [txns, period, query]);

  const totals = useMemo(() => {
    if (!filteredTxns || filteredTxns.length === 0) {
      return { balance: 0, in: 0, out: 0, currency: "USD" };
    }
    let income = 0;
    let expense = 0;
    const currency = filteredTxns[0].base_currency;
    for (const t of filteredTxns) {
      if (t.state !== "posted") continue;
      if (
        t.kind === "donation" ||
        t.kind === "transfer_in" ||
        t.base_amount_cents > 0
      ) {
        income += Math.abs(t.base_amount_cents);
      } else {
        expense += Math.abs(t.base_amount_cents);
      }
    }
    return { balance: income - expense, in: income, out: expense, currency };
  }, [filteredTxns]);

  // Build a 14-point sparkline from recent posted txns (newest right).
  const trend = useMemo(() => {
    if (!filteredTxns) return [];
    const points: number[] = [];
    let running = 0;
    const sorted = [...filteredTxns]
      .filter((t) => t.state === "posted")
      .sort(
        (a, b) =>
          new Date(a.occurred_on).getTime() - new Date(b.occurred_on).getTime()
      );
    for (const t of sorted) {
      const sign =
        t.kind === "donation" || t.base_amount_cents > 0 ? 1 : -1;
      running += sign * Math.abs(t.base_amount_cents);
      points.push(running);
    }
    const take = points.slice(-14);
    return take.length < 2 ? [0, 0] : take;
  }, [filteredTxns]);

  return (
    <Page>
      <Title>Finance</Title>

      <SegmentedControl
        label="Period"
        size="sm"
        options={[
          { value: "month", label: "This month" },
          { value: "quarter", label: "This quarter" },
          { value: "year", label: "This year" },
          { value: "all", label: "All time" },
        ]}
        value={period}
        onChange={setPeriod}
      />

      <Hero padding="lg">
        <HeroLabel>Net position</HeroLabel>
        {filteredTxns === null ? (
          <Skeleton height={40} width="60%" />
        ) : (
          <HeroValue>{money(totals.balance, totals.currency)}</HeroValue>
        )}
        <HeroRow>
          <HeroStat>
            <div style={{ opacity: 0.8, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Donations in
            </div>
            <HeroStatValue>{money(totals.in, totals.currency)}</HeroStatValue>
          </HeroStat>
          <HeroStat>
            <div style={{ opacity: 0.8, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Expenses out
            </div>
            <HeroStatValue>{money(totals.out, totals.currency)}</HeroStatValue>
          </HeroStat>
        </HeroRow>
        {trend.length > 1 && (
          <div style={{ marginTop: 16 }}>
            <TrendLine
              values={trend}
              width={320}
              height={40}
              stroke="rgba(255,255,255,0.9)"
              fill="rgba(255,255,255,0.15)"
            />
          </div>
        )}
      </Hero>

      {err && (
        <Banner tone="danger" title="Couldn't load finance" action={
          <Button variant="ghost" size="sm" onClick={() => void load()}>Retry</Button>
        }>
          {err}
        </Banner>
      )}

      <Grid>
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <SectionTitle>Funds</SectionTitle>
          {funds === null ? (
            <Funds>
              {[0, 1].map((i) => (
                <Card key={i}>
                  <Skeleton height={14} width="40%" />
                  <div style={{ height: 10 }} />
                  <Skeleton height={20} width="70%" />
                </Card>
              ))}
            </Funds>
          ) : funds.length === 0 ? (
            <Card padding="none">
              <EmptyState title="No funds yet" />
            </Card>
          ) : (
            <Funds>
              {funds.map((f) => (
                <Card key={f._id}>
                  <FundHead>
                    <FundName>{f.name}</FundName>
                    <Badge tone="neutral">{f.kind}</Badge>
                  </FundHead>
                  <FundSub>{f.code}</FundSub>
                  <FundBalance>{money(f.balance_cents, f.base_currency)}</FundBalance>
                  <FundMeta>
                    in {money(f.total_in_cents, f.base_currency)} · out{" "}
                    {money(f.total_out_cents, f.base_currency)}
                  </FundMeta>
                </Card>
              ))}
            </Funds>
          )}
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <SectionHead>
            <SectionTitle>Transactions</SectionTitle>
            <span style={{ fontSize: 12, color: "var(--am-ink-muted)" }}>
              {filteredTxns ? `${filteredTxns.length} total` : ""}
            </span>
          </SectionHead>

          <SearchField
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery("")}
            placeholder="Search by memo, id, or kind"
          />

          <Chips>
            <FilterChip active={state === "all"} onClick={() => setState("all")}>
              All
            </FilterChip>
            {STATES.map((s) => (
              <FilterChip key={s} active={state === s} onClick={() => setState(s)}>
                {s}
              </FilterChip>
            ))}
          </Chips>

          {filteredTxns === null ? (
            <List>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ padding: 16, borderBottom: "1px solid var(--am-border)" }}>
                  <Skeleton height={16} width="70%" />
                  <div style={{ height: 6 }} />
                  <Skeleton height={12} width="40%" />
                </div>
              ))}
            </List>
          ) : filteredTxns.length === 0 ? (
            <Card padding="none">
              <EmptyState title="No transactions" description="Try a different period or state." />
            </Card>
          ) : (
            <List>
              {filteredTxns.map((t) => {
                const neg =
                  t.kind !== "donation" &&
                  t.kind !== "transfer_in" &&
                  t.base_amount_cents <= 0;
                return (
                  <ListRow
                    key={t._id}
                    href={`/admin/finance/transactions/${t._id}`}
                    title={`${t.public_id ?? t._id.slice(0, 8)} · ${t.kind}`}
                    meta={`${new Date(t.occurred_on).toLocaleDateString()}${t.memo ? ` · ${t.memo}` : ""}`}
                    trailing={
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                        <Amount $neg={neg}>
                          {neg ? "−" : "+"}
                          {money(Math.abs(t.base_amount_cents), t.base_currency)}
                        </Amount>
                        <Badge tone={stateTone(t.state)}>{t.state}</Badge>
                      </div>
                    }
                  />
                );
              })}
            </List>
          )}
        </section>
      </Grid>
    </Page>
  );
}

/* ---------------- Legacy (preserved) ---------------- */

function LegacyFinance() {
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
          <article key={f._id} style={legacyCard}>
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
        <button onClick={() => setState("")} aria-pressed={state === ""} style={pillStyle(state === "")}>
          all
        </button>
        {STATES.map((s) => (
          <button key={s} onClick={() => setState(s)} aria-pressed={state === s} style={pillStyle(state === s)}>
            {s}
          </button>
        ))}
      </div>

      {err ? <ErrorState message={err} onRetry={() => void load()} /> : null}
      {txns === null ? <LoadingState /> : null}
      {txns && txns.length === 0 ? <LegacyEmpty title="No transactions" /> : null}
      {txns && txns.length > 0 ? (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.5rem" }}>
          {txns.map((t) => (
            <li key={t._id} style={legacyCard}>
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
                <StatusBadge tone={t.state === "posted" ? "active" : "pending"}>
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

const legacyCard: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: "0.9rem 1.2rem",
  background: "#fff",
};
function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: "0.35rem 0.8rem",
    borderRadius: 999,
    border: active ? "2px solid #111827" : "1px solid #e5e7eb",
    background: active ? "#111827" : "#fff",
    color: active ? "#fff" : "#111827",
    cursor: "pointer",
  };
}
