"use client";

import styled from "styled-components";
import { motion } from "framer-motion";
import { Container } from "@/components/ui/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { finalCta } from "@/data/content";

const Wrap = styled.section`
  position: relative;
  padding-block: ${({ theme }) => theme.space[16]};
  background: ${({ theme }) => theme.gradients.trust};
  color: #fff;
  overflow: hidden;
  text-align: center;
`;

const Sun = styled(motion.div)`
  position: absolute;
  left: 50%;
  top: -30%;
  translate: -50%;
  width: min(900px, 120vw);
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(
    circle at 50% 50%,
    rgba(247, 183, 51, 0.4) 0%,
    rgba(242, 140, 40, 0.16) 36%,
    transparent 62%
  );
  pointer-events: none;
`;

const Rays = styled.div`
  position: absolute;
  inset: -40% -20% auto -20%;
  height: 90%;
  background: repeating-conic-gradient(
    from 0deg at 50% 0%,
    rgba(255, 250, 224, 0) 0deg,
    rgba(255, 250, 224, 0.06) 3deg,
    rgba(255, 250, 224, 0) 9deg
  );
  pointer-events: none;
`;

const Inner = styled.div`
  position: relative;
  max-width: 760px;
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
`;

const Title = styled.h2`
  color: #fff;
  font-size: clamp(2.4rem, 5vw, 4rem);
`;

const Body = styled.p`
  color: ${({ theme }) => theme.colors.onDarkSoft};
  font-size: 1.2rem;
  max-width: 50ch;
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: center;
  margin-top: 1rem;
`;

const Pillars = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1.5rem;
  margin-top: 2.5rem;
  font-size: 0.85rem;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.onDarkSoft};
  span b {
    color: ${({ theme }) => theme.colors.hopeGold};
  }
`;

export function FinalCTA() {
  return (
    <Wrap>
      <Rays />
      <Sun
        animate={{ scale: [1, 1.06, 1], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <Container>
        <Inner>
          <Reveal>
            <SectionLabel $onDark>{finalCta.eyebrow}</SectionLabel>
          </Reveal>
          <Reveal delay={0.05}>
            <Title>{finalCta.title}</Title>
          </Reveal>
          <Reveal delay={0.1}>
            <Body>{finalCta.body}</Body>
          </Reveal>
          <Reveal delay={0.15}>
            <Actions>
              <Button href={finalCta.primary.href} variant="primary">
                {finalCta.primary.label} →
              </Button>
              <Button href={finalCta.secondary.href} variant="light">
                {finalCta.secondary.label}
              </Button>
            </Actions>
          </Reveal>
          <Pillars>
            <span>
              Caring for 30+ children <b>since 2016</b>
            </span>
            <span>
              In partnership with <b>Honest Need</b>
            </span>
            <span>
              <b>Cancel</b> anytime
            </span>
          </Pillars>
        </Inner>
      </Container>
    </Wrap>
  );
}
