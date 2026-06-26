"use client";

import styled, { css } from "styled-components";
import { motion } from "framer-motion";
import { Container, Section } from "@/components/ui/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Reveal, RevealGroup, revealItem } from "@/components/ui/Reveal";
import { testimonials, type Testimonial } from "@/data/content";
import { media } from "@/styles/theme";

const Head = styled.div`
  text-align: center;
  max-width: 640px;
  margin: 0 auto 3.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  h2 {
    font-size: ${({ theme }) => theme.type.h2};
  }
`;

const Grid = styled(RevealGroup)`
  display: grid;
  gap: 1.5rem;
  grid-template-columns: 1fr;
  ${media.md} {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

const toneAccent = {
  gold: css`
    --c: ${({ theme }) => theme.colors.hopeGold};
  `,
  green: css`
    --c: ${({ theme }) => theme.colors.foundationGreen};
  `,
  blue: css`
    --c: ${({ theme }) => theme.colors.trustBlue};
  `,
};

const Card = styled(motion.figure)<{ $tone: Testimonial["tone"] }>`
  ${({ $tone }) => toneAccent[$tone]}
  position: relative;
  padding: 2.25rem;
  border-radius: ${({ theme }) => theme.radius.lg};
  background: ${({ theme }) => theme.colors.bg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.shadow.soft};
  display: flex;
  flex-direction: column;
`;

const Mark = styled.span`
  font-family: ${({ theme }) => theme.font.heading};
  font-size: 4rem;
  line-height: 0.6;
  color: var(--c);
  opacity: 0.25;
`;

const Quote = styled.blockquote`
  font-family: ${({ theme }) => theme.font.heading};
  font-size: 1.3rem;
  line-height: 1.4;
  color: ${({ theme }) => theme.colors.trustBlue};
  margin: 0.75rem 0 1.75rem;
`;

const Person = styled.figcaption`
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 0.85rem;
`;

const Avatar = styled.span`
  width: 46px;
  height: 46px;
  flex: none;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-family: ${({ theme }) => theme.font.heading};
  font-weight: ${({ theme }) => theme.weight.bold};
  color: #fff;
  background: var(--c);
`;

const Who = styled.div`
  strong {
    display: block;
    color: ${({ theme }) => theme.colors.trustBlue};
    font-size: 0.98rem;
  }
  span {
    font-size: 0.85rem;
    color: ${({ theme }) => theme.colors.inkMuted};
  }
`;

export function Testimonials() {
  return (
    <Section>
      <Container $wide>
        <Head>
          <Reveal>
            <SectionLabel>Voices of the partnership</SectionLabel>
            <h2>The people behind the promise.</h2>
          </Reveal>
        </Head>

        <Grid>
          {testimonials.map((t) => (
            <Card key={t.id} $tone={t.tone} variants={revealItem} whileHover={{ y: -6 }}>
              <Mark aria-hidden>&ldquo;</Mark>
              <Quote>{t.quote}</Quote>
              <Person>
                <Avatar aria-hidden>{t.name.charAt(0)}</Avatar>
                <Who>
                  <strong>{t.name}</strong>
                  <span>{t.role}</span>
                </Who>
              </Person>
            </Card>
          ))}
        </Grid>
      </Container>
    </Section>
  );
}
