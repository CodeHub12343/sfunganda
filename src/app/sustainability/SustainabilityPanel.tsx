"use client";

import { useMemo, useState } from "react";
import styled from "styled-components";
import { Container, Section } from "@/components/ui/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { EmptyState } from "@/components/ui/States";

type Row = {
  seq: number;
  posted_at: string;
  amount_cents: number;
  account: string;
  transaction_public_id: string | null;
};

type MonthRow = {
  month: string;
  revenue_base_cents: number;
  operating_expense_base_cents: number;
  ratio: number;
  revenue_rows: Row[];
  expense_rows: Row[];
};

type Props = {
  data: {
    community: { slug: string; name: string } | null;
    months: MonthRow[];
  };
};

const Head = styled.header`
  padding: clamp(120px, 15vh, 180px) 0 1rem;
  text-align: center;
  h1 {
    font-family: ${({ theme }) => theme.font.heading};
    font-size: clamp(2rem, 5vw, 3rem);
    color: ${({ theme }) => theme.colors.trustBlue};
    margin: 0.5rem 0;
  }
  p {
    color: ${({ theme }) => theme.colors.inkMuted};
    max-width: 60ch;
    margin: 0 auto;
  }
`;

const Bars = styled.ol`
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 0.4rem;
  align-items: end;
  min-height: 240px;
  padding: 0;
  margin: 0 0 2rem;
  list-style: none;
`;

const Bar = styled.li<{ $pct: number; $active: boolean }>`
  cursor: pointer;
  display: grid;
  grid-template-rows: 1fr auto;
  gap: 0.4rem;
  min-height: 200px;
  button {
    all: unset;
    width: 100%;
    height: ${({ $pct }) => Math.min(100, $pct)}%;
    min-height: 2px;
    background: ${({ theme, $active }) =>
      $active ? theme.colors.sunriseOrange : theme.colors.foundationGreen};
    border-radius: 6px 6px 0 0;
    display: block;
    align-self: end;
    cursor: pointer;
    &:focus-visible {
      outline: 3px solid ${({ theme }) => theme.colors.sunriseOrange};
      outline-offset: 2px;
    }
  }
  figcaption {
    text-align: center;
    font-size: 0.72rem;
    color: ${({ theme }) => theme.colors.inkMuted};
    letter-spacing: 0.04em;
  }
`;

const Numbers = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
  div {
    padding: 1rem 1.25rem;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.radius.md};
    background: #fff;
    strong {
      display: block;
      font-family: ${({ theme }) => theme.font.heading};
      font-size: 1.6rem;
      color: ${({ theme }) => theme.colors.trustBlue};
    }
    span {
      font-size: 0.78rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: ${({ theme }) => theme.colors.inkMuted};
    }
  }
`;

const Tables = styled.div`
  display: grid;
  gap: 2rem;
  @media (min-width: 900px) {
    grid-template-columns: 1fr 1fr;
  }
`;

const TableBlock = styled.div`
  background: #fff;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  overflow: hidden;
  h3 {
    margin: 0;
    padding: 1rem 1.25rem;
    background: ${({ theme }) => theme.colors.bgSoft};
    font-size: 0.9rem;
    color: ${({ theme }) => theme.colors.ink};
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.88rem;
  }
  th,
  td {
    text-align: left;
    padding: 0.6rem 1.25rem;
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  }
  td:last-child {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
`;

function money(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function SustainabilityPanel({ data }: Props) {
  const [selected, setSelected] = useState(data.months.length - 1);
  const current = data.months[selected];

  const pcts = useMemo(() => {
    const max = Math.max(1, ...data.months.map((m) => Math.max(m.revenue_base_cents, m.operating_expense_base_cents)));
    return data.months.map((m) => ({
      revenue: (m.revenue_base_cents / max) * 100,
      expense: (m.operating_expense_base_cents / max) * 100,
    }));
  }, [data.months]);

  return (
    <>
      <Head>
        <Container>
          <SectionLabel>Transparency</SectionLabel>
          <h1>Sustainability{data.community ? ` · ${data.community.name}` : ""}</h1>
          <p>
            How much of our operating costs are covered by the businesses we
            run. The figures below come straight from the ledger and never
            count donations as revenue — you can recompute them from the
            rows listed.
          </p>
        </Container>
      </Head>

      <Section>
        <Container>
          {data.months.length === 0 ? (
            <EmptyState
              title="No months yet"
              description="Once production records are approved, this chart fills in automatically."
            />
          ) : (
            <>
              <Bars aria-label="Monthly operating revenue vs. operating expenses">
                {data.months.map((m, i) => (
                  <Bar key={m.month} $pct={pcts[i]!.revenue} $active={i === selected}>
                    <button
                      type="button"
                      onClick={() => setSelected(i)}
                      aria-label={`${m.month}: ratio ${(m.ratio * 100).toFixed(0)} percent`}
                      aria-pressed={i === selected}
                    />
                    <figcaption>{m.month.slice(5)}</figcaption>
                  </Bar>
                ))}
              </Bars>

              {current ? (
                <>
                  <Numbers>
                    <div>
                      <span>Month</span>
                      <strong>{current.month}</strong>
                    </div>
                    <div>
                      <span>Business revenue</span>
                      <strong>{money(current.revenue_base_cents)}</strong>
                    </div>
                    <div>
                      <span>Operating expenses</span>
                      <strong>{money(current.operating_expense_base_cents)}</strong>
                    </div>
                    <div>
                      <span>Sustainability</span>
                      <strong>{(current.ratio * 100).toFixed(0)}%</strong>
                    </div>
                  </Numbers>
                  <Tables>
                    <TableBlock>
                      <h3>Revenue rows</h3>
                      <table>
                        <thead>
                          <tr>
                            <th>Posted</th>
                            <th>Txn</th>
                            <th>Account</th>
                            <th>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {current.revenue_rows.length === 0 ? (
                            <tr>
                              <td colSpan={4}>No revenue rows for this month.</td>
                            </tr>
                          ) : (
                            current.revenue_rows.map((r) => (
                              <tr key={r.seq}>
                                <td>{new Date(r.posted_at).toLocaleDateString()}</td>
                                <td>{r.transaction_public_id ?? "—"}</td>
                                <td>{r.account}</td>
                                <td>{money(r.amount_cents)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </TableBlock>
                    <TableBlock>
                      <h3>Operating expense rows</h3>
                      <table>
                        <thead>
                          <tr>
                            <th>Posted</th>
                            <th>Txn</th>
                            <th>Account</th>
                            <th>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {current.expense_rows.length === 0 ? (
                            <tr>
                              <td colSpan={4}>No operating expense rows for this month.</td>
                            </tr>
                          ) : (
                            current.expense_rows.map((r) => (
                              <tr key={r.seq}>
                                <td>{new Date(r.posted_at).toLocaleDateString()}</td>
                                <td>{r.transaction_public_id ?? "—"}</td>
                                <td>{r.account}</td>
                                <td>{money(r.amount_cents)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </TableBlock>
                  </Tables>
                </>
              ) : null}
            </>
          )}
        </Container>
      </Section>
    </>
  );
}
