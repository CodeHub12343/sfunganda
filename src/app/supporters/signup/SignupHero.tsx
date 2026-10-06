"use client";

import styled from "styled-components";
import NextLink from "next/link";
import { Container, Section } from "@/components/ui/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { media } from "@/styles/theme";

const Grid = styled.div`
  display: grid;
  gap: 3rem;
  align-items: start;
  grid-template-columns: 1fr;
  ${media.lg} {
    grid-template-columns: 0.95fr 1.05fr;
  }
`;

const Intro = styled.div`
  padding-top: 2rem;
  h1 {
    font-family: ${({ theme }) => theme.font.heading};
    font-size: ${({ theme }) => theme.type.h1};
    color: ${({ theme }) => theme.colors.trustBlue};
    margin: 1rem 0 1.25rem;
    line-height: 1.1;
  }
  p {
    color: ${({ theme }) => theme.colors.inkSoft};
    max-width: 46ch;
    font-size: 1.05rem;
    line-height: 1.6;
  }
`;

const Compare = styled.div`
  margin-top: 2rem;
  padding: 1.25rem 1.5rem;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.warmCream};
  border: 1px solid ${({ theme }) => theme.colors.border};
  h3 {
    margin: 0 0 0.5rem;
    font-size: 0.78rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.trustBlue};
  }
  p {
    margin: 0 0 0.4rem;
    font-size: 0.95rem;
    color: ${({ theme }) => theme.colors.inkSoft};
  }
  a {
    color: ${({ theme }) => theme.colors.trustBlue};
    font-weight: ${({ theme }) => theme.weight.semibold};
    text-underline-offset: 3px;
  }
`;

export function SignupHero({ children }: { children: React.ReactNode }) {
  return (
    <Section id="supporter-signup" $tone="soft">
      <Container>
        <Grid>
          <Intro>
            <SectionLabel>Join as a supporter</SectionLabel>
            <h1>Follow the children&apos;s story — every step.</h1>
            <p>
              Create a free supporter account to follow projects, receive
              updates when milestones are met, and keep a tidy record of your
              donation receipts.
            </p>
            <Compare>
              <h3>Not what you&apos;re looking for?</h3>
              <p>
                Want to volunteer your time or outreach instead?{" "}
                <NextLink href="/#volunteer">Go to the volunteer form →</NextLink>
              </p>
              <p>
                Ready to give today?{" "}
                <NextLink href="/#sponsor">Donate here →</NextLink>
              </p>
            </Compare>
          </Intro>
          <div>{children}</div>
        </Grid>
      </Container>
    </Section>
  );
}
