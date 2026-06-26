"use client";

import styled, { css } from "styled-components";
import { motion } from "framer-motion";
import { Container, Section } from "@/components/ui/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Reveal, RevealGroup, revealItem } from "@/components/ui/Reveal";
import { areas, type AreaOfImpact } from "@/data/content";
import { media } from "@/styles/theme";

const Head = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 720px;
  margin-bottom: 3.5rem;
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

const accentMap = {
  gold: css`
    --accent: ${({ theme }) => theme.colors.hopeGold};
    --accent-grad: ${({ theme }) => theme.gradients.sunrise};
  `,
  green: css`
    --accent: ${({ theme }) => theme.colors.foundationGreen};
    --accent-grad: ${({ theme }) => theme.gradients.growth};
  `,
  blue: css`
    --accent: ${({ theme }) => theme.colors.trustBlue};
    --accent-grad: ${({ theme }) => theme.gradients.trust};
  `,
};

const Card = styled(motion.article)<{ $accent: AreaOfImpact["accent"] }>`
  ${({ $accent }) => accentMap[$accent]}
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 380px;
  padding: 2.25rem;
  border-radius: ${({ theme }) => theme.radius.lg};
  background: ${({ theme }) => theme.colors.bg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.shadow.soft};
  overflow: hidden;
  transition:
    transform 0.4s ${({ theme }) => theme.ease.out},
    box-shadow 0.4s ${({ theme }) => theme.ease.out};

  &::before {
    content: "";
    position: absolute;
    inset: 0 0 auto 0;
    height: 5px;
    background: var(--accent-grad);
  }

  &:hover {
    transform: translateY(-8px);
    box-shadow: ${({ theme }) => theme.shadow.lift};
  }
`;

const IconRing = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--accent) 14%, white);
  color: var(--accent);
  margin-bottom: 1.5rem;
`;

const Title = styled.h3`
  font-size: ${({ theme }) => theme.type.h4};
  color: ${({ theme }) => theme.colors.trustBlue};
`;

const Blurb = styled.p`
  margin-top: 0.75rem;
  color: ${({ theme }) => theme.colors.inkSoft};
`;

const Detail = styled(motion.p)`
  color: ${({ theme }) => theme.colors.inkMuted};
  font-size: 0.95rem;
  overflow: hidden;
`;

const Metric = styled.div`
  margin-top: auto;
  padding-top: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: ${({ theme }) => theme.weight.semibold};
  color: var(--accent);
  font-size: 0.95rem;
`;

const icons: Record<string, React.ReactNode> = {
  "child-welfare": (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 21s-7-4.5-7-9.5A4 4 0 0 1 12 9a4 4 0 0 1 7 2.5C19 16.5 12 21 12 21Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
  housing: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 11l8-6 8 6M6 10v9h12v-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 19v-5h4v5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
  education: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 8l9-4 9 4-9 4-9-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M7 10v5c0 1.1 2.2 2.5 5 2.5s5-1.4 5-2.5v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
};

export function AreasOfImpact() {
  return (
    <Section $tone="soft">
      <Container $wide>
        <Head>
          <Reveal>
            <SectionLabel>Areas of Impact</SectionLabel>
            <h2>Three ways your kindness becomes a turning point.</h2>
          </Reveal>
        </Head>

        <Grid>
          {areas.map((a) => (
            <Card
              key={a.id}
              $accent={a.accent}
              variants={revealItem}
              initial="rest"
              whileHover="hover"
              animate="rest"
            >
              <IconRing>{icons[a.id]}</IconRing>
              <Title>{a.title}</Title>
              <Blurb>{a.blurb}</Blurb>
              <Detail
                variants={{
                  rest: { opacity: 0.85, height: "auto", marginTop: 12 },
                  hover: { opacity: 1, height: "auto", marginTop: 12 },
                }}
              >
                {a.detail}
              </Detail>
              <Metric>
                <Spark /> {a.metric}
              </Metric>
            </Card>
          ))}
        </Grid>
      </Container>
    </Section>
  );
}

function Spark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0l1.8 4.6L14.5 6 9.8 7.4 8 12 6.2 7.4 1.5 6l4.7-1.4L8 0Z" />
    </svg>
  );
}
