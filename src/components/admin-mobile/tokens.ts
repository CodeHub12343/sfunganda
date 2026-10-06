// Admin-mobile tokens as TypeScript consts. Mirrors admin-tokens.css so JS can
// reference the same scale (e.g. for inline SVG attributes).

export const amSpace = {
  0.5: "2px",
  1: "4px",
  1.5: "6px",
  2: "8px",
  3: "12px",
  4: "16px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
} as const;

export const amType = {
  display: { size: "28px", line: "36px", weight: 700 },
  h1: { size: "22px", line: "30px", weight: 700 },
  h2: { size: "18px", line: "26px", weight: 600 },
  h3: { size: "16px", line: "24px", weight: 600 },
  body: { size: "15px", line: "22px", weight: 400 },
  bodySm: { size: "13px", line: "20px", weight: 400 },
  micro: { size: "11px", line: "16px", weight: 500 },
} as const;

export const amBreakpoint = {
  xs: 320,
  sm: 390,
  md: 768,
  lg: 1024,
  xl: 1440,
} as const;

export const amMedia = {
  sm: `@media (min-width: ${amBreakpoint.sm}px)`,
  md: `@media (min-width: ${amBreakpoint.md}px)`,
  lg: `@media (min-width: ${amBreakpoint.lg}px)`,
  xl: `@media (min-width: ${amBreakpoint.xl}px)`,
  belowMd: `@media (max-width: ${amBreakpoint.md - 1}px)`,
  belowLg: `@media (max-width: ${amBreakpoint.lg - 1}px)`,
  reduceMotion: `@media (prefers-reduced-motion: reduce)`,
} as const;
