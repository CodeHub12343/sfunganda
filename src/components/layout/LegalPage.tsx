"use client";

import styled from "styled-components";
import { Container } from "@/components/ui/Container";

const Wrap = styled.article`
  padding: clamp(140px, 18vh, 220px) 0 ${({ theme }) => theme.space[12]};
  background: ${({ theme }) => theme.colors.bg};
`;

const Head = styled.header`
  margin-bottom: 2.5rem;
  h1 {
    font-family: ${({ theme }) => theme.font.heading};
    font-size: clamp(2rem, 5vw, 3rem);
    color: ${({ theme }) => theme.colors.trustBlue};
    line-height: 1.1;
  }
  p {
    margin-top: 0.9rem;
    color: ${({ theme }) => theme.colors.inkMuted};
    font-size: 0.95rem;
  }
`;

const Body = styled.div`
  max-width: 72ch;
  color: ${({ theme }) => theme.colors.ink};
  line-height: 1.65;
  font-size: 1rem;

  h2 {
    font-family: ${({ theme }) => theme.font.heading};
    font-size: 1.5rem;
    color: ${({ theme }) => theme.colors.trustBlue};
    margin-top: 2.5rem;
    margin-bottom: 0.9rem;
  }
  p + p {
    margin-top: 1rem;
  }
  ul {
    margin: 1rem 0 1rem 1.25rem;
    list-style: disc;
    display: grid;
    gap: 0.4rem;
  }
  a {
    color: ${({ theme }) => theme.colors.foundationGreen};
    text-decoration: underline;
  }
`;

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <Wrap>
      <Container>
        <Head>
          <h1>{title}</h1>
          <p>Last updated: {updated}</p>
        </Head>
        <Body>{children}</Body>
      </Container>
    </Wrap>
  );
}
