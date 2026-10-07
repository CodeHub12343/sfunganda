"use client";

import { useState } from "react";
import styled from "styled-components";
import { Container, Section } from "@/components/ui/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { EmptyState } from "@/components/ui/States";
import { api, ApiClientError } from "@/lib/api";

type Item = {
  id: string;
  period_kind: "month" | "quarter" | "year";
  period_code: string;
  title: string;
  published_at: string;
  content_hash: string | null;
  download_path: string;
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

const Grid = styled.ol`
  display: grid;
  gap: 1rem;
  padding: 0;
  margin: 0;
  list-style: none;
`;

const Card = styled.li`
  background: #fff;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  h3 {
    margin: 0;
    font-family: ${({ theme }) => theme.font.heading};
    color: ${({ theme }) => theme.colors.trustBlue};
    font-size: 1.15rem;
  }
  p {
    margin: 0.1rem 0 0;
    color: ${({ theme }) => theme.colors.inkMuted};
    font-size: 0.88rem;
  }
`;

const Download = styled.button`
  background: ${({ theme }) => theme.gradients.sunrise};
  color: #fff;
  border: none;
  border-radius: ${({ theme }) => theme.radius.pill};
  padding: 0.7rem 1.4rem;
  font-weight: 600;
  cursor: pointer;
  &:focus-visible {
    outline: 3px solid ${({ theme }) => theme.colors.sunriseOrange};
    outline-offset: 2px;
  }
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

export function ReportsArchive({ items }: { items: Item[] }) {
  const [pending, setPending] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function download(item: Item) {
    if (pending) return;
    setErr(null);
    setPending(item.id);
    try {
      const r = await api<{ url: string }>(item.download_path);
      window.open(r.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Could not open the PDF.");
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <Head>
        <Container>
          <SectionLabel>Published</SectionLabel>
          <h1>Reports archive</h1>
          <p>
            Monthly and quarterly impact reports. The figures in each PDF are
            frozen at the moment of approval and match the ledger entries for
            that period — you can hand-recompute the finance totals from the
            sustainability page.
          </p>
        </Container>
      </Head>
      <Section>
        <Container>
          {items.length === 0 ? (
            <EmptyState
              title="No reports yet"
              description="Published reports appear here. The first one is drafted automatically after the first full month of approved data."
            />
          ) : (
            <>
              {err ? (
                <p role="alert" style={{ color: "#b91c1c", marginBottom: "1rem" }}>
                  {err}
                </p>
              ) : null}
              <Grid aria-label="Published reports">
                {items.map((r) => (
                  <Card key={r.id}>
                    <div>
                      <h3>
                        {r.title}
                      </h3>
                      <p>
                        {r.period_code} · published {new Date(r.published_at).toLocaleDateString()}
                        {r.content_hash ? ` · content hash ${r.content_hash.slice(0, 10)}…` : ""}
                      </p>
                    </div>
                    <Download onClick={() => download(r)} disabled={pending === r.id}>
                      {pending === r.id ? "Opening…" : "Download PDF"}
                    </Download>
                  </Card>
                ))}
              </Grid>
            </>
          )}
        </Container>
      </Section>
    </>
  );
}
