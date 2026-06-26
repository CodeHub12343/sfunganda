"use client";

import { useState } from "react";
import styled from "styled-components";
import { AnimatePresence, motion } from "framer-motion";
import { Container, Section } from "@/components/ui/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Reveal } from "@/components/ui/Reveal";
import { regions } from "@/data/content";
import { media } from "@/styles/theme";

const Grid = styled.div`
  display: grid;
  gap: 3rem;
  align-items: center;
  grid-template-columns: 1fr;
  ${media.lg} {
    grid-template-columns: 1.1fr 0.9fr;
  }
`;

const MapWrap = styled.div`
  position: relative;
  aspect-ratio: 4 / 5;
  max-width: 480px;
  margin-inline: auto;
  width: 100%;
`;

const Continent = styled.svg`
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 24px 50px rgba(16, 61, 122, 0.18));
`;

const Pin = styled(motion.button)<{ $active: boolean }>`
  position: absolute;
  translate: -50% -50%;
  width: ${({ $active }) => ($active ? "26px" : "20px")};
  height: ${({ $active }) => ($active ? "26px" : "20px")};
  border-radius: 50%;
  background: ${({ theme }) => theme.gradients.sunrise};
  box-shadow: 0 0 0 6px rgba(247, 183, 51, 0.22);
  border: 2px solid #fff;
  cursor: pointer;
  transition: width 0.25s, height 0.25s;
  &::after {
    content: "";
    position: absolute;
    inset: -10px;
    border-radius: 50%;
    border: 2px solid ${({ theme }) => theme.colors.sunriseOrange};
    opacity: ${({ $active }) => ($active ? 1 : 0)};
    animation: ${({ $active }) => ($active ? "ping 1.6s ease-out infinite" : "none")};
  }
  @keyframes ping {
    0% { transform: scale(0.6); opacity: 0.8; }
    100% { transform: scale(1.6); opacity: 0; }
  }
`;

const Panel = styled.div`
  h2 {
    font-size: ${({ theme }) => theme.type.h2};
    margin: 1rem 0 1.25rem;
  }
`;

const Card = styled(motion.div)`
  padding: 1.75rem;
  border-radius: ${({ theme }) => theme.radius.lg};
  background: ${({ theme }) => theme.colors.bg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.shadow.soft};
`;

const RegionName = styled.h3`
  font-size: ${({ theme }) => theme.type.h4};
  color: ${({ theme }) => theme.colors.trustBlue};
`;

const Stats = styled.div`
  display: flex;
  gap: 2rem;
  margin: 1rem 0 1.1rem;
  strong {
    display: block;
    font-family: ${({ theme }) => theme.font.heading};
    font-size: 1.8rem;
    color: ${({ theme }) => theme.colors.sunriseOrange};
    line-height: 1;
  }
  span {
    font-size: 0.85rem;
    color: ${({ theme }) => theme.colors.inkMuted};
  }
`;

const Blurb = styled.p`
  color: ${({ theme }) => theme.colors.inkSoft};
`;

const Pills = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1.5rem;
`;

const RegionPill = styled.button<{ $active: boolean }>`
  padding: 0.55rem 1rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  font-size: 0.85rem;
  font-weight: ${({ theme }) => theme.weight.medium};
  border: 1px solid
    ${({ theme, $active }) =>
      $active ? theme.colors.sunriseOrange : theme.colors.border};
  background: ${({ theme, $active }) =>
    $active ? theme.colors.warmCream : "transparent"};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.sunriseOrange : theme.colors.inkSoft};
  transition: all 0.2s;
`;

// Stylised continent outline (decorative — not geographically exact).
const AFRICA =
  "M150 20c30 0 44 16 64 22s38-6 50 10-8 30-6 48 16 28 12 48-22 24-28 44-2 38-18 52-16 32-34 38-32-10-44-24-8-32-22-42-32-14-40-32-2-36-14-50-26-22-28-44 8-34 0-52-16-28-4-44 22-12 32-22 18-22 48-22z";

export function ImpactMap() {
  const [active, setActive] = useState(regions[0].id);
  const region = regions.find((r) => r.id === active)!;

  return (
    <Section $tone="premium">
      <Container $wide>
        <Reveal>
          <SectionLabel>Where hope takes root</SectionLabel>
        </Reveal>
        <Grid>
          <MapWrap>
            <Continent viewBox="0 0 300 380" aria-label="Map showing Sarah's Foundation's work in Uganda, East Africa">
              <defs>
                <linearGradient id="map-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#E9F4EC" />
                  <stop offset="1" stopColor="#D5EBDD" />
                </linearGradient>
              </defs>
              <path d={AFRICA} fill="url(#map-grad)" stroke="#3D8B37" strokeWidth="2" strokeOpacity="0.5" />
            </Continent>
            {regions.map((r) => (
              <Pin
                key={r.id}
                $active={r.id === active}
                style={{ left: `${r.x}%`, top: `${r.y}%` }}
                onClick={() => setActive(r.id)}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                aria-label={`${r.name}: ${r.headline} ${r.unit}`}
              />
            ))}
          </MapWrap>

          <Panel>
            <h2>Rooted in Uganda. Building a home for generations.</h2>
            <AnimatePresence mode="wait">
              <Card
                key={region.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <RegionName>{region.name}</RegionName>
                <Stats>
                  <div>
                    <strong>{region.headline}</strong>
                    <span>{region.unit}</span>
                  </div>
                </Stats>
                <Blurb>{region.blurb}</Blurb>
              </Card>
            </AnimatePresence>
            <Pills>
              {regions.map((r) => (
                <RegionPill
                  key={r.id}
                  $active={r.id === active}
                  onClick={() => setActive(r.id)}
                >
                  {r.name}
                </RegionPill>
              ))}
            </Pills>
          </Panel>
        </Grid>
      </Container>
    </Section>
  );
}
