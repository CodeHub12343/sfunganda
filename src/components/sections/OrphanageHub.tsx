"use client";

import styled from "styled-components";
import { motion } from "framer-motion";
import { Container, Section } from "@/components/ui/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Reveal, RevealGroup, revealItem } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";
import { orphanages } from "@/data/content";
import { media } from "@/styles/theme";

const Head = styled.div`
  max-width: 720px;
  margin-bottom: 3.5rem;
  h2 {
    font-size: ${({ theme }) => theme.type.h2};
    margin-top: 1rem;
  }
  p {
    margin-top: 1rem;
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

const Card = styled(motion.article)`
  display: flex;
  flex-direction: column;
  border-radius: ${({ theme }) => theme.radius.lg};
  overflow: hidden;
  background: ${({ theme }) => theme.colors.bg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.shadow.soft};
`;

const Cover = styled.div<{ $src: string; $position?: string }>`
  position: relative;
  height: 172px;
  background: ${({ theme }) => theme.colors.foundationGreen};
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    inset: -1px;
    background-image: url("${({ $src }) => $src}");
    background-position: ${({ $position }) => $position ?? "50% 50%"};
    background-size: cover;
    transform: scale(1.01);
    transition: transform 700ms ease;
  }

  ${Card}:hover &::before {
    transform: scale(1.06);
  }

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background:
      linear-gradient(180deg, rgba(7, 17, 29, 0.12) 0%, rgba(7, 17, 29, 0.05) 42%, rgba(7, 17, 29, 0.72) 100%),
      linear-gradient(90deg, rgba(30, 93, 53, 0.48), rgba(30, 93, 53, 0.05));
  }
`;

const Location = styled.span`
  position: absolute;
  z-index: 2;
  left: 1rem;
  bottom: 0.85rem;
  color: #fff;
  font-size: 0.8rem;
  font-weight: ${({ theme }) => theme.weight.semibold};
  display: flex;
  align-items: center;
  gap: 0.35rem;
  text-shadow: 0 1px 8px rgba(7, 17, 29, 0.48);
`;

const Body = styled.div`
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  flex: 1;
`;

const Name = styled.h3`
  font-size: 1.35rem;
  color: ${({ theme }) => theme.colors.trustBlue};
`;

const Story = styled.p`
  margin-top: 0.6rem;
  font-size: 0.92rem;
  color: ${({ theme }) => theme.colors.inkSoft};
`;

const ProgressMeta = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin: 1.4rem 0 0.5rem;
  strong {
    font-family: ${({ theme }) => theme.font.heading};
    font-size: 1.25rem;
    color: ${({ theme }) => theme.colors.foundationGreen};
  }
  span {
    font-size: 0.82rem;
    color: ${({ theme }) => theme.colors.inkMuted};
  }
`;

const Track = styled.div`
  height: 8px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.bgSoft};
  border: 1px solid ${({ theme }) => theme.colors.border};
  overflow: hidden;
`;

const Fill = styled(motion.div)`
  height: 100%;
  border-radius: 999px;
  background: ${({ theme }) => theme.gradients.growth};
`;

const Foot = styled.div`
  margin-top: 1.5rem;
`;

export function OrphanageHub() {
  return (
    <Section $tone="soft">
      <Container $wide>
        <Head>
          <Reveal>
            <SectionLabel>Orphanage Support Hub</SectionLabel>
            <h2>Choose a home. Help complete its story.</h2>
            <p>
              Each home has a name, a family, and a funding goal. Follow the
              progress and see exactly what your gift makes possible.
            </p>
          </Reveal>
        </Head>

        <Grid>
          {orphanages.map((o) => {
            const pct = Math.min(100, Math.round((o.raised / o.goal) * 100));
            return (
              <Card key={o.id} variants={revealItem} whileHover={{ y: -6 }}>
                <Cover $src={o.image.src} $position={o.image.position}>
                  <Location>
                    <Pin /> {o.location}
                  </Location>
                </Cover>
                <Body>
                  <Name>{o.name}</Name>
                  <Story>{o.story}</Story>
                  <ProgressMeta>
                    <strong>${o.raised.toLocaleString()}</strong>
                    <span>of ${o.goal.toLocaleString()} · {o.children} children</span>
                  </ProgressMeta>
                  <Track>
                    <Fill
                      initial={{ width: 0 }}
                      whileInView={{ width: `${pct}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </Track>
                  <Foot>
                    <Button href="#sponsor" variant="ghost" full>
                      Support {o.name.split(" ")[0]}
                    </Button>
                  </Foot>
                </Body>
              </Card>
            );
          })}
        </Grid>
      </Container>
    </Section>
  );
}

function Pin() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="#fff" aria-hidden>
      <path d="M6 0C3.8 0 2 1.8 2 4c0 3 4 8 4 8s4-5 4-8c0-2.2-1.8-4-4-4Zm0 5.5A1.5 1.5 0 1 1 6 2.5a1.5 1.5 0 0 1 0 3Z" />
    </svg>
  );
}
