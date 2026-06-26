"use client";

import styled, { css } from "styled-components";
import { motion } from "framer-motion";
import { Container, Section } from "@/components/ui/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Reveal, RevealGroup, revealItem } from "@/components/ui/Reveal";
import { featuredStories, type Story } from "@/data/content";
import { media } from "@/styles/theme";

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
    max-width: 36ch;
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

const Card = styled(motion.article)<{ $tone: Story["tone"] }>`
  ${({ $tone }) => toneMap[$tone]}
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 440px;
  border-radius: ${({ theme }) => theme.radius.lg};
  overflow: hidden;
  color: #fff;
  background: var(--c);
  box-shadow: ${({ theme }) => theme.shadow.soft};
  isolation: isolate;
  transform: translateZ(0);
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background:
      linear-gradient(180deg, rgba(7, 17, 29, 0.26) 0%, rgba(7, 17, 29, 0.2) 26%, rgba(7, 17, 29, 0.88) 100%),
      linear-gradient(90deg, rgba(7, 17, 29, 0.55), rgba(7, 17, 29, 0.12) 58%);
    z-index: -1;
  }
`;

const ImageLayer = styled.div<{ $src: string; $position?: string }>`
  position: absolute;
  inset: 0;
  z-index: -2;
  background-image: url("${({ $src }) => $src}");
  background-position: ${({ $position }) => $position ?? "50% 50%"};
  background-size: cover;
  transform: scale(1.02);
  transition: transform 700ms ease;

  ${Card}:hover & {
    transform: scale(1.07);
  }
`;

const ToneWash = styled.div`
  position: absolute;
  inset: 0;
  z-index: -1;
  opacity: 0.28;
  background: var(--c);
  mix-blend-mode: color;
`;

const Top = styled.div`
  padding: 1.75rem;
`;

const Tag = styled.span`
  display: inline-block;
  font-size: 0.72rem;
  font-weight: ${({ theme }) => theme.weight.bold};
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.4rem 0.8rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(4px);
`;

const Quote = styled.p`
  font-family: ${({ theme }) => theme.font.heading};
  font-size: 1.5rem;
  line-height: 1.25;
  margin-top: 1.25rem;
`;

const Bottom = styled.div`
  margin-top: auto;
  padding: 1.75rem;
`;

const Name = styled.div`
  font-weight: ${({ theme }) => theme.weight.bold};
  font-size: 1.1rem;
`;

const Meta = styled.div`
  font-size: 0.85rem;
  opacity: 0.85;
  margin-bottom: 1.1rem;
`;

const Change = styled.div`
  display: grid;
  gap: 0.6rem;
`;

const Row = styled.div<{ $after?: boolean }>`
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  font-size: 0.9rem;
  line-height: 1.4;
  b {
    flex: none;
    font-size: 0.68rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: 999px;
    background: ${({ $after }) =>
      $after ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.16)"};
    color: ${({ $after, theme }) => ($after ? theme.colors.trustBlue : "#fff")};
    margin-top: 2px;
  }
`;

export function FeaturedStories() {
  return (
    <Section id="stories">
      <Container $wide>
        <Head>
          <Reveal>
            <SectionLabel>Stories of Hope</SectionLabel>
            <h2>Behind every number, a life that changed.</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p>
              Representative journeys reflect real patterns of transformation -
              from need, to support, to a future no one saw coming.
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
              <ImageLayer
                $src={s.image.src}
                $position={s.image.position}
                role="img"
                aria-label={s.image.alt}
              />
              <ToneWash />
              <Top>
                <Tag>{s.tag}</Tag>
                <Quote>&ldquo;{s.quote}&rdquo;</Quote>
              </Top>
              <Bottom>
                <Name>{s.name}</Name>
                <Meta>
                  Age {s.age} · {s.region}
                </Meta>
                <Change>
                  <Row>
                    <b>Before</b>
                    <span>{s.before}</span>
                  </Row>
                  <Row $after>
                    <b>After</b>
                    <span>{s.after}</span>
                  </Row>
                </Change>
              </Bottom>
            </Card>
          ))}
        </Grid>
      </Container>
    </Section>
  );
}
