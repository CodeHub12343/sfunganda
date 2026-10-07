"use client";

import styled, { keyframes } from "styled-components";

type Props = {
  width?: string | number;
  height?: string | number;
  radius?: string;
  circle?: boolean;
  className?: string;
};

const shimmer = keyframes`
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
`;

const Root = styled.div<{
  $w?: string | number;
  $h?: string | number;
  $r?: string;
  $circle?: boolean;
}>`
  display: block;
  background: linear-gradient(
    90deg,
    var(--am-bg-soft) 0%,
    var(--am-border) 50%,
    var(--am-bg-soft) 100%
  );
  background-size: 800px 100%;
  animation: ${shimmer} 1.4s linear infinite;
  width: ${({ $w }) => (typeof $w === "number" ? `${$w}px` : ($w ?? "100%"))};
  height: ${({ $h }) => (typeof $h === "number" ? `${$h}px` : ($h ?? "16px"))};
  border-radius: ${({ $circle, $r }) =>
    $circle ? "var(--am-radius-pill)" : ($r ?? "var(--am-radius-sm)")};

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    background: var(--am-bg-soft);
  }
`;

export function Skeleton({ width, height, radius, circle, className }: Props) {
  return (
    <Root
      $w={width}
      $h={height}
      $r={radius}
      $circle={circle}
      className={className}
      aria-hidden="true"
    />
  );
}
