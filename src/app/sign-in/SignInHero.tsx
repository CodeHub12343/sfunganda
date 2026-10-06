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

export function SignInHero({ children }: { children: React.ReactNode }) {
  return (
    <Section id="sign-in" $tone="soft">
      <Container>
        <Grid>
          <Intro>
            <SectionLabel>Sign in</SectionLabel>
            <h1>Welcome back — pick up where you left off.</h1>
            <p>
              Sign in to follow the children&apos;s story, manage your
              donations and preferences, or — if you&apos;re staff — reach the
              admin workspace.
            </p>
            <Compare>
              <h3>New here?</h3>
              <p>
                Don&apos;t have a supporter account yet?{" "}
                <NextLink href="/supporters/signup">Create one in a minute →</NextLink>
              </p>
              <p>
                Prefer to volunteer or donate without an account?{" "}
                <NextLink href="/#volunteer">Volunteer</NextLink> or{" "}
                <NextLink href="/#sponsor">give today</NextLink>.
              </p>
            </Compare>
          </Intro>
          <div>{children}</div>
        </Grid>
      </Container>
    </Section>
  );
}
