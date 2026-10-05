"use client";

import styled from "styled-components";
import { motion } from "framer-motion";
import { Container, Section } from "@/components/ui/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Reveal, RevealGroup, revealItem } from "@/components/ui/Reveal";
import { transparency, transparencyDocs } from "@/data/content";
import { media } from "@/styles/theme";

const Head = styled.div`
  display: grid;
  gap: 2rem;
  align-items: end;
  grid-template-columns: 1fr;
  margin-bottom: 3.5rem;
  ${media.md} {
    grid-template-columns: 1.4fr 1fr;
  }
  h2 {
    font-size: ${({ theme }) => theme.type.h2};
    margin-top: 1rem;
  }
  p {
    color: ${({ theme }) => theme.colors.inkSoft};
  }
`;

const Stats = styled(RevealGroup)`
  display: grid;
  gap: 1.25rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  ${media.md} {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
`;

const Stat = styled(motion.div)`
  padding: 1.75rem;
  border-radius: ${({ theme }) => theme.radius.lg};
  background: ${({ theme }) => theme.colors.bg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.shadow.soft};
  strong {
    display: block;
    font-family: ${({ theme }) => theme.font.heading};
    font-size: 2.4rem;
    line-height: 1;
    color: ${({ theme }) => theme.colors.foundationGreen};
  }
  b {
    display: block;
    margin: 0.6rem 0 0.2rem;
    color: ${({ theme }) => theme.colors.trustBlue};
    font-size: 0.95rem;
  }
  span {
    font-size: 0.85rem;
    color: ${({ theme }) => theme.colors.inkMuted};
  }
`;

const Docs = styled.div`
  margin-top: 1.25rem;
  display: grid;
  gap: 0.85rem;
  grid-template-columns: 1fr;
  ${media.sm} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  ${media.lg} {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
`;

const Doc = styled(motion.a)`
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 1rem 1.25rem;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.bgSoft};
  border: 1px solid ${({ theme }) => theme.colors.border};
  transition: all 0.25s ${({ theme }) => theme.ease.out};
  &:hover {
    background: #fff;
    box-shadow: ${({ theme }) => theme.shadow.soft};
    transform: translateY(-3px);
  }
  div {
    min-width: 0;
  }
  strong {
    display: block;
    font-size: 0.92rem;
    color: ${({ theme }) => theme.colors.trustBlue};
  }
  span {
    font-size: 0.78rem;
    color: ${({ theme }) => theme.colors.inkMuted};
  }
`;

const DocIcon = styled.span`
  flex: none;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, ${({ theme }) => theme.colors.foundationGreen} 14%, white);
  color: ${({ theme }) => theme.colors.foundationGreen};
`;

export function Transparency() {
  return (
    <Section id="transparency" $tone="soft">
      <Container $wide>
        <Head>
          <Reveal>
            <SectionLabel>Transparency Center</SectionLabel>
            <h2>Trust isn&apos;t claimed. It&apos;s shown.</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p>
              In partnership with Honest Need, we share exactly where your gift
              goes — and the honest steps we&apos;re taking toward full legal
              registration.
            </p>
          </Reveal>
        </Head>

        <Stats>
          {transparency.map((t) => (
            <Stat key={t.label} variants={revealItem}>
              <strong>{t.value}</strong>
              <b>{t.label}</b>
              <span>{t.note}</span>
            </Stat>
          ))}
        </Stats>

        <Reveal delay={0.15}>
          <Docs>
            {transparencyDocs.map((d) => (
              <Doc key={d.title} href={d.href} whileTap={{ scale: 0.98 }}>
                <DocIcon>
                  <FileIcon />
                </DocIcon>
                <div>
                  <strong>{d.title}</strong>
                  <span>{d.meta}</span>
                </div>
              </Doc>
            ))}
          </Docs>
        </Reveal>
      </Container>
    </Section>
  );
}

function FileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 2h8l4 4v16H6V2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 2v4h4M9 13h6M9 17h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
