"use client";

import { useId } from "react";
import NextLink from "next/link";
import styled from "styled-components";

const Wrap = styled(NextLink)<{ $onDark?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
  color: ${({ theme, $onDark }) =>
    $onDark ? theme.colors.onDark : theme.colors.trustBlue};
  text-decoration: none;
  &:focus-visible {
    outline: 3px solid ${({ theme }) => theme.colors.sunriseOrange};
    outline-offset: 3px;
    border-radius: 4px;
  }
`;

const Mark = styled.span`
  width: 42px;
  height: 42px;
  flex: none;
  display: grid;
  place-items: center;
`;

const Words = styled.span`
  display: flex;
  flex-direction: column;
  line-height: 1;
`;

const Name = styled.span`
  font-family: ${({ theme }) => theme.font.heading};
  font-weight: ${({ theme }) => theme.weight.bold};
  font-size: clamp(1.1rem, 4.5vw, 1.35rem);
  letter-spacing: -0.01em;
  white-space: nowrap;
`;

const Sub = styled.span<{ $onDark?: boolean }>`
  font-family: ${({ theme }) => theme.font.body};
  font-size: 0.58rem;
  font-weight: ${({ theme }) => theme.weight.semibold};
  letter-spacing: 0.22em;
  text-transform: uppercase;
  margin-top: 4px;
  color: ${({ theme, $onDark }) =>
    $onDark ? theme.colors.onDarkSoft : theme.colors.foundationGreen};
`;

export function Logo({ onDark }: { onDark?: boolean }) {
  // T14: unique id per instance so multiple logos (navbar + mobile sheet + footer)
  // can't collide on the shared `lg-sun` gradient reference.
  const gradientId = useId();
  return (
    <Wrap href="/" $onDark={onDark} aria-label="Sarah's Foundation home">
      <Mark>
        <svg width="42" height="42" viewBox="0 0 42 42" fill="none" aria-hidden>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#F7B733" />
              <stop offset="1" stopColor="#F28C28" />
            </linearGradient>
          </defs>
          <circle cx="21" cy="21" r="20" fill="#103D7A" />
          <path d="M5 26a16 16 0 0 1 32 0Z" fill={`url(#${gradientId})`} />
          {[...Array(5)].map((_, i) => {
            const a = (-90 + (i - 2) * 26) * (Math.PI / 180);
            return (
              <line
                key={i}
                x1="21"
                y1="20"
                x2={21 + Math.cos(a) * 11}
                y2={20 + Math.sin(a) * 11}
                stroke="#FFF4D6"
                strokeWidth="1.4"
                strokeLinecap="round"
                opacity="0.85"
              />
            );
          })}
          <path d="M14 26h14v-3l-7-4-7 4Z" fill="#1E5D35" />
          <rect x="19.6" y="23" width="2.8" height="3" fill="#FFF9F2" rx="0.4" />
          <path d="M5 26h32" stroke="#FFF9F2" strokeWidth="1.2" opacity="0.6" />
        </svg>
      </Mark>
      <Words>
        <Name>Sarah&apos;s Foundation</Name>
        <Sub $onDark={onDark}>Hope · Home · Lives</Sub>
      </Words>
    </Wrap>
  );
}
