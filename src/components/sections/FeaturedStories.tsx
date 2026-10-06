"use client";

import styled, { css } from "styled-components";
import { motion } from "framer-motion";
import { Container, Section } from "@/components/ui/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Reveal, RevealGroup, revealItem } from "@/components/ui/Reveal";
import { featuredStories as fallbackStories, type ProgrammeStory } from "@/data/content";
import { media } from "@/styles/theme";

// D10: no stock photographs of identifiable children paired with invented
// names, ages, or first-person quotes. Each card describes the programme —
// what the children receive — not a fictional individual.

const Head = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.5rem;
  margin-bottom: 3rem;
  h2 {
    font-size: ${({ theme }) => theme.type.h2};
    max-width: 16ch;
  }
  p {
    max-width: 42ch;
    color: ${({ theme }) => theme.colors.inkSoft};
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

const toneMap = {
  gold: css`
    --c: ${({ theme }) => theme.gradients.sunrise};
  `,
  green: css`
    --c: ${({ theme }) => theme.gradients.growth};
  `,
  blue: css`
    --c: ${({ theme }) => theme.gradients.trust};
  `,
};

const Card = styled(motion.article)<{ $tone: ProgrammeStory["tone"] }>`
  ${({ $tone }) => toneMap[$tone]}
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 360px;
  border-radius: ${({ theme }) => theme.radius.lg};
  overflow: hidden;
  color: #fff;
  background: var(--c);
  box-shadow: ${({ theme }) => theme.shadow.soft};
  padding: 2rem;
`;

const Tag = styled.span`
  display: inline-block;
  font-size: 0.72rem;
  font-weight: ${({ theme }) => theme.weight.bold};
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.4rem 0.8rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: rgba(255, 255, 255, 0.2);
  width: fit-content;
`;

const Title = styled.h3`
  font-family: ${({ theme }) => theme.font.heading};
  font-size: 1.6rem;
  line-height: 1.2;
  margin-top: 1.25rem;
`;

const Summary = styled.p`
  margin-top: 0.9rem;
  font-size: 1rem;
  line-height: 1.5;
  opacity: 0.95;
`;

const Body = styled.p`
  margin-top: auto;
  padding-top: 1.25rem;
  font-size: 0.9rem;
  line-height: 1.55;
  opacity: 0.9;
  border-top: 1px solid rgba(255, 255, 255, 0.25);
`;

export function FeaturedStories({ stories = fallbackStories }: { stories?: ProgrammeStory[] } = {}) {
  const featuredStories = stories;
  return (
    <Section id="stories">
      <Container $wide>
        <Head>
          <Reveal>
            <SectionLabel>Our work in Uganda</SectionLabel>
            <h2>Programmes, not profiles.</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p>
              We don&apos;t publish photographs or named stories of the children
              in our care. These are the programmes your gift supports — the
              daily reality for every child at Sarah&apos;s Foundation.
            </p>
          </Reveal>
        </Head>

        <Grid stagger={0.12}>
          {featuredStories.map((s) => (
            <Card
              key={s.id}
              $tone={s.tone}
              variants={revealItem}
              whileHover={{ y: -8 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
            >
              <Tag>{s.tag}</Tag>
              <Title>{s.title}</Title>
              <Summary>{s.summary}</Summary>
              <Body>{s.body}</Body>
            </Card>
          ))}
        </Grid>
      </Container>
    </Section>
  );
}
