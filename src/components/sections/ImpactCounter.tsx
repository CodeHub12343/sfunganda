"use client";

import styled from "styled-components";
import { Container } from "@/components/ui/Container";
import { StatCounter } from "@/components/ui/StatCounter";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Reveal, RevealGroup, revealItem } from "@/components/ui/Reveal";
import { impactStats, type Stat } from "@/data/content";
import { media } from "@/styles/theme";
import { motion } from "framer-motion";

const Band = styled.section`
  position: relative;
  background: ${({ theme }) => theme.gradients.trust};
  color: #fff;
  padding-block: ${({ theme }) => theme.space[12]};
  overflow: hidden;
`;

const Glow = styled.div`
  position: absolute;
  inset: auto -10% -50% -10%;
  height: 90%;
  background: radial-gradient(50% 60% at 50% 100%, rgba(247, 183, 51, 0.22), transparent 70%);
  pointer-events: none;
`;

const Head = styled.div`
  text-align: center;
  max-width: 640px;
  margin: 0 auto 3.5rem;
  h2 {
    color: #fff;
    margin-top: 1rem;
    font-size: ${({ theme }) => theme.type.h2};
  }
  p {
    margin-top: 1rem;
    color: ${({ theme }) => theme.colors.onDarkSoft};
  }
`;

const CenterLabel = styled.div`
  display: flex;
  justify-content: center;
`;

const Grid = styled(RevealGroup)`
  display: grid;
  gap: 1.25rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  ${media.md} {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
`;

const Card = styled(motion.div)`
  position: relative;
  text-align: center;
  padding: 2rem 1.25rem;
  border-radius: ${({ theme }) => theme.radius.card};
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(6px);
`;

const Number = styled.div`
  font-family: ${({ theme }) => theme.font.heading};
  font-weight: ${({ theme }) => theme.weight.bold};
  font-size: clamp(2.4rem, 5vw, 3.4rem);
  line-height: 1;
  background: ${({ theme }) => theme.gradients.sunrise};
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
`;

const Label = styled.div`
  margin-top: 0.6rem;
  font-weight: ${({ theme }) => theme.weight.semibold};
  color: #fff;
`;

const Detail = styled.p`
  margin-top: 0.4rem;
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.onDarkSoft};
`;

export function ImpactCounter({ stats = impactStats }: { stats?: Stat[] } = {}) {
  return (
    <Band id="impact">
      <Glow />
      <Container $wide>
        <Head>
          <Reveal>
            <CenterLabel>
              <SectionLabel $onDark>Real impact, measured</SectionLabel>
            </CenterLabel>
            <h2>Numbers that are really names.</h2>
            <p>
              Every figure below is a child who slept safe, a family kept
              together, a future that changed direction.
            </p>
          </Reveal>
        </Head>

        <Grid>
          {stats.map((s) => (
            <Card key={s.label} variants={revealItem}>
              <Number>
                <StatCounter value={s.value} suffix={s.suffix} prefix={s.prefix} />
              </Number>
              <Label>{s.label}</Label>
              <Detail>{s.detail}</Detail>
            </Card>
          ))}
        </Grid>
      </Container>
    </Band>
  );
}
