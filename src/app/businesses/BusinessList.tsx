"use client";

import styled from "styled-components";
import { Container, Section } from "@/components/ui/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { EmptyState } from "@/components/ui/States";

type Business = {
  slug: string;
  name: string;
  kind: string;
  summary: string;
  community: { slug: string; name: string; region_label: string } | null;
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

const Grid = styled.div`
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
`;

const Card = styled.article`
  padding: 1.5rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  h3 {
    margin: 0;
    font-family: ${({ theme }) => theme.font.heading};
    font-size: 1.2rem;
    color: ${({ theme }) => theme.colors.trustBlue};
  }
  p {
    margin: 0;
    color: ${({ theme }) => theme.colors.inkSoft};
    font-size: 0.92rem;
  }
`;

const Tag = styled.span`
  display: inline-block;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: ${({ theme }) => theme.colors.bgSoft};
  color: ${({ theme }) => theme.colors.ink};
  align-self: flex-start;
`;

export function BusinessList({ items }: { items: Business[] }) {
  return (
    <>
      <Head>
        <Container>
          <SectionLabel>Self-sustainability</SectionLabel>
          <h1>Businesses that fund the home</h1>
          <p>
            Poultry, farming, crafts and small shops the foundation runs so
            the children&apos;s home can one day cover its own costs. Revenue
            from these businesses is tracked in the public ledger — see the
            sustainability page.
          </p>
        </Container>
      </Head>
      <Section>
        <Container>
          {items.length === 0 ? (
            <EmptyState
              title="No businesses yet"
              description="Businesses appear here once a director has reviewed and published them."
            />
          ) : (
            <Grid>
              {items.map((b) => (
                <Card key={b.slug}>
                  <Tag>{b.kind}</Tag>
                  <h3>{b.name}</h3>
                  <p>{b.summary}</p>
                  {b.community ? (
                    <p>
                      <strong>{b.community.name}</strong> · {b.community.region_label}
                    </p>
                  ) : null}
                </Card>
              ))}
            </Grid>
          )}
        </Container>
      </Section>
    </>
  );
}
