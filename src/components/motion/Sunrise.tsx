"use client";

import styled, { keyframes } from "styled-components";
import { motion, useReducedMotion } from "framer-motion";

// Cinematic, lightweight sunrise scene built from CSS + SVG + Framer Motion.
// Stands in for the future Three.js hero without the performance cost.

const sweep = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;

const Stage = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  max-width: 560px;
  margin-inline: auto;
  border-radius: 50%;
  overflow: hidden;
  background: ${({ theme }) => theme.gradients.sunriseRadial};
  box-shadow:
    inset 0 -30px 80px rgba(226, 115, 27, 0.35),
    ${({ theme }) => theme.shadow.glass};
  isolation: isolate;
`;

const Rays = styled.div`
  position: absolute;
  inset: -25%;
  background:
    repeating-conic-gradient(
      from 0deg at 50% 60%,
      rgba(255, 250, 224, 0.0) 0deg,
      rgba(255, 250, 224, 0.55) 4deg,
      rgba(255, 250, 224, 0.0) 12deg
    );
  mix-blend-mode: screen;
  animation: ${sweep} 90s linear infinite;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Sun = styled(motion.div)`
  position: absolute;
  left: 50%;
  top: 58%;
  width: 46%;
  aspect-ratio: 1;
  translate: -50% -50%;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 45%, #fffefb 0%, #ffe27a 45%, #f7b733 100%);
  box-shadow: 0 0 80px rgba(255, 226, 122, 0.9);
`;

const Land = styled.div`
  position: absolute;
  inset: auto 0 0 0;
  height: 38%;
  background:
    linear-gradient(180deg, #3d8b37 0%, #1e5d35 100%);
  border-radius: 50% 50% 0 0 / 28% 28% 0 0;
`;

const River = styled.div`
  position: absolute;
  left: 12%;
  right: 12%;
  bottom: 14%;
  height: 12%;
  border-radius: 50%;
  background: linear-gradient(180deg, #a6d7ff, #5fa8e6);
  opacity: 0.85;
  filter: blur(0.3px);
`;

// Simplified Africa silhouette path, centered in the disc.
const AfricaWrap = styled(motion.svg)`
  position: absolute;
  left: 50%;
  top: 46%;
  translate: -50% -50%;
  width: 40%;
  height: auto;
  filter: drop-shadow(0 6px 20px rgba(30, 93, 53, 0.45));
`;

const Figures = styled.svg`
  position: absolute;
  left: 50%;
  bottom: 10%;
  translate: -50%;
  width: 70%;
  height: auto;
`;

const AFRICA_PATH =
  "M40 4c8 0 12 5 18 6s10-2 13 3-3 9-2 14 5 8 4 14-6 7-7 13-1 11-5 15-3 9-7 12-4 9-9 10-9-3-12-7-2-9-6-12-9-4-11-9-1-10-4-14-7-6-8-12 2-10 0-15-4-8-1-13 6-3 9-6 9-7 17-7z";

export function Sunrise() {
  const reduce = useReducedMotion();
  return (
    <Stage role="img" aria-label="A sunrise rising over Africa with children at home">
      <Rays />
      <Sun
        initial={reduce ? false : { scale: 0.6, y: 30, opacity: 0.4 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
      />
      <AfricaWrap
        viewBox="0 0 84 130"
        fill="#2f7a33"
        initial={reduce ? false : { opacity: 0, scale: 0.92 }}
        animate={{ opacity: 0.92, scale: 1 }}
        transition={{ duration: 1.4, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden
      >
        <path d={AFRICA_PATH} transform="scale(1.0) translate(0 0)" />
      </AfricaWrap>
      <Land />
      <River />
      <Figures viewBox="0 0 200 60" aria-hidden>
        {[18, 56, 100, 144, 182].map((x, i) => (
          <g key={x} fill="#0b2546">
            <circle cx={x} cy={14 - (i % 2) * 2} r="7" />
            <rect
              x={x - 8}
              y="20"
              width="16"
              height="30"
              rx="7"
              ry="9"
            />
          </g>
        ))}
        {/* joined hands line */}
        <path
          d="M18 30 Q37 22 56 30 T100 30 T144 30 T182 30"
          stroke="#0b2546"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      </Figures>
    </Stage>
  );
}
