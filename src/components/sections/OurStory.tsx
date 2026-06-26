"use client";

import styled from "styled-components";
import { motion } from "framer-motion";
import { Container, Section } from "@/components/ui/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Reveal } from "@/components/ui/Reveal";
import { story } from "@/data/content";
import { media } from "@/styles/theme";

const Head = styled.div`
  max-width: 760px;
  margin-bottom: 4rem;
  h2 {
    margin-top: 1.1rem;
    font-size: ${({ theme }) => theme.type.h2};
  }
  p {
    margin-top: 1.25rem;
    font-size: 1.2rem;
    color: ${({ theme }) => theme.colors.inkSoft};
  }
`;

const Timeline = styled.div`
  position: relative;
  display: grid;
  gap: 2rem;
  grid-template-columns: 1fr;
  ${media.md} {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.75rem;
  }
`;

const Track = styled.div`
  display: none;
  ${media.md} {
    display: block;
    position: absolute;
    top: 30px;
    left: 0;
    right: 0;
    height: 2px;
    background: ${({ theme }) => theme.colors.border};
  }
`;

const TrackFill = styled(motion.div)`
  height: 100%;
  background: ${({ theme }) => theme.gradients.sunrise};
  transform-origin: left;
`;

const Item = styled(motion.div)`
  position: relative;
`;

const Dot = styled.div`
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: ${({ theme }) => theme.gradients.sunrise};
  box-shadow: 0 0 0 6px ${({ theme }) => theme.colors.warmCream};
  margin-bottom: 1.75rem;
  ${media.md} {
    margin-left: 11px;
  }
`;

const Tag = styled.span`
  font-size: 0.78rem;
  font-weight: ${({ theme }) => theme.weight.bold};
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.foundationGreen};
`;

const ItemTitle = styled.h3`
  font-size: ${({ theme }) => theme.type.h4};
  margin: 0.5rem 0 0.6rem;
`;

const Body = styled.p`
  color: ${({ theme }) => theme.colors.inkSoft};
`;

export function OurStory() {
  return (
    <Section id="story" $tone="premium">
      <Container $wide>
        <Head>
          <Reveal>
            <SectionLabel>{story.eyebrow}</SectionLabel>
            <h2>{story.title}</h2>
            <p>{story.lede}</p>
          </Reveal>
        </Head>

        <Timeline>
          <Track>
            <TrackFill
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
            />
          </Track>
          {story.timeline.map((t, i) => (
            <Item
              key={t.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 + i * 0.18, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <Dot />
              <Tag>
                {t.tag} · {t.year}
              </Tag>
              <ItemTitle>{t.title}</ItemTitle>
              <Body>{t.body}</Body>
            </Item>
          ))}
        </Timeline>
      </Container>
    </Section>
  );
}
