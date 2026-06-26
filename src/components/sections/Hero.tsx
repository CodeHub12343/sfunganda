"use client";

import styled from "styled-components";
import { motion, useReducedMotion } from "framer-motion";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { StatCounter } from "@/components/ui/StatCounter";
import { Sunrise } from "@/components/motion/Sunrise";
import { hero } from "@/data/content";
import { media } from "@/styles/theme";

const Wrap = styled.section`
  position: relative;
  padding-top: clamp(120px, 18vh, 200px);
  padding-bottom: ${({ theme }) => theme.space[12]};
  background: ${({ theme }) => theme.gradients.dawn};
  overflow: hidden;
`;

const Aurora = styled.div`
  position: absolute;
  inset: -10% -10% auto -10%;
  height: 70%;
  background: radial-gradient(
    50% 60% at 70% 20%,
    rgba(247, 183, 51, 0.18),
    transparent 60%
  );
  pointer-events: none;
`;

const Grid = styled.div`
  position: relative;
  display: grid;
  gap: clamp(2.5rem, 5vw, 4rem);
  align-items: center;
  grid-template-columns: 1fr;
  ${media.lg} {
    grid-template-columns: 1.05fr 0.95fr;
  }
`;

const Copy = styled.div`
  max-width: 620px;
`;

const Headline = styled.h1`
  font-size: ${({ theme }) => theme.type.display};
  margin: 1.4rem 0 0;
  span {
    display: block;
    overflow: hidden;
  }
  em {
    font-style: italic;
    color: ${({ theme }) => theme.colors.sunriseOrange};
  }
`;

const Line = styled(motion.span)`
  display: block;
`;

const Sub = styled.p`
  margin-top: 1.5rem;
  font-size: clamp(1.05rem, 1.4vw, 1.25rem);
  color: ${({ theme }) => theme.colors.inkSoft};
  max-width: 52ch;
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 2.25rem;
`;

const Trust = styled.div`
  display: flex;
  align-items: center;
  gap: 0.85rem;
  margin-top: 2.25rem;
  color: ${({ theme }) => theme.colors.inkMuted};
  font-size: 0.9rem;
  svg {
    flex: none;
  }
`;

const Scene = styled.div`
  position: relative;
`;

const Chip = styled(motion.div)`
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0.85rem 1.1rem;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  box-shadow: ${({ theme }) => theme.shadow.glass};
  strong {
    font-family: ${({ theme }) => theme.font.heading};
    font-size: 1.4rem;
    color: ${({ theme }) => theme.colors.trustBlue};
    line-height: 1;
  }
  span {
    font-size: 0.72rem;
    color: ${({ theme }) => theme.colors.inkMuted};
    letter-spacing: 0.02em;
  }
  ${media.belowMd} {
    padding: 0.6rem 0.8rem;
    /* keep chips anchored inside the scene on small screens */
    left: clamp(2px, 2vw, 12px) !important;
    right: auto !important;
    strong {
      font-size: 1.1rem;
    }
  }
`;

const float = {
  animate: (i: number) => ({
    y: [0, -10, 0],
    transition: {
      duration: 4 + i,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  }),
};

const chipPos = [
  { top: "6%", left: "-4%" },
  { top: "40%", right: "-6%" },
  { bottom: "4%", left: "6%" },
];

export function Hero() {
  const reduce = useReducedMotion();

  return (
    <Wrap id="top">
      <Aurora />
      <Container $wide>
        <Grid>
          <Copy>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <SectionLabel>{hero.eyebrow}</SectionLabel>
            </motion.div>

            <Headline>
              {hero.headline.map((line, i) => (
                <span key={line}>
                  <Line
                    initial={reduce ? false : { y: "110%" }}
                    animate={{ y: 0 }}
                    transition={{
                      duration: 0.8,
                      delay: 0.15 + i * 0.12,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    {i === 0 ? (
                      line
                    ) : i === 1 ? (
                      <>
                        <em>hope</em>, safety, and a
                      </>
                    ) : (
                      line
                    )}
                  </Line>
                </span>
              ))}
            </Headline>

            <Sub>{hero.subhead}</Sub>

            <Actions>
              <Button href={hero.primaryCta.href} variant="primary">
                {hero.primaryCta.label} →
              </Button>
              <Button href={hero.secondaryCta.href} variant="secondary">
                <PlayIcon /> {hero.secondaryCta.label}
              </Button>
            </Actions>

            <Trust>
              <ShieldIcon />
              <span>
                In partnership with <strong>Honest Need</strong> · every gift
                goes directly to the children
              </span>
            </Trust>
          </Copy>

          <Scene>
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            >
              <Sunrise />
            </motion.div>

            {hero.floatingStats.map((s, i) => (
              <Chip
                key={s.label}
                style={chipPos[i]}
                custom={i}
                variants={reduce ? undefined : float}
                animate={reduce ? undefined : "animate"}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.7 + i * 0.15, duration: 0.5 }}
              >
                <strong>
                  <StatCounter value={s.value} />
                </strong>
                <span>{s.label}</span>
              </Chip>
            ))}
          </Scene>
        </Grid>
      </Container>
    </Wrap>
  );
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M5 3.5v9l7-4.5-7-4.5Z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M10 2l6 2.4v4.2c0 4-2.6 7-6 8.4-3.4-1.4-6-4.4-6-8.4V4.4L10 2Z"
        fill="#3D8B37"
        opacity="0.18"
      />
      <path
        d="M10 2l6 2.4v4.2c0 4-2.6 7-6 8.4-3.4-1.4-6-4.4-6-8.4V4.4L10 2Z"
        stroke="#3D8B37"
        strokeWidth="1.3"
      />
      <path d="M7.2 9.8l1.9 1.9 3.7-3.9" stroke="#3D8B37" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
