// =============================================================================
// Sarah's Foundation — Design System
// Tokens derived directly from the brand blueprint & logo analysis.
// "Modern Humanitarian Luxury": hope of a sunrise, warmth of a home,
// trust of a world-class institution.
// =============================================================================

export const theme = {
  colors: {
    // --- Primary (from logo) ---
    hopeGold: "#F7B733",
    sunriseOrange: "#F28C28",
    foundationGreen: "#3D8B37",
    trustBlue: "#103D7A",

    // --- Secondary ---
    forestGreen: "#1E5D35",
    skyBlue: "#A6D7FF",
    warmCream: "#FFF9F2",

    // --- Accent / semantic ---
    success: "#22C55E",
    impact: "#14B8A6",
    attention: "#F59E0B",

    // --- Backgrounds ---
    bg: "#FFFFFF",
    bgSoft: "#F8FAFC",
    bgPremium: "#FDFCF8",
    bgDark: "#07111D",

    // --- Text ---
    ink: "#0B1F3A", // near-trust-blue, for body on light
    inkSoft: "#41506A",
    inkMuted: "#6B7A93",
    onDark: "#F4F7FB",
    onDarkSoft: "#A9B7CC",

    // --- Lines / surfaces ---
    border: "rgba(16, 61, 122, 0.10)",
    borderStrong: "rgba(16, 61, 122, 0.18)",
    glass: "rgba(255, 255, 255, 0.7)",
  },

  gradients: {
    sunrise:
      "linear-gradient(135deg, #F7B733 0%, #F28C28 48%, #F59E0B 100%)",
    sunriseRadial:
      "radial-gradient(120% 120% at 50% 0%, #FFE7A8 0%, #F7B733 26%, #F28C28 58%, #E2731B 100%)",
    growth:
      "linear-gradient(135deg, #3D8B37 0%, #1E5D35 100%)",
    trust:
      "linear-gradient(135deg, #103D7A 0%, #07111D 100%)",
    dawn:
      "linear-gradient(180deg, #FFF9F2 0%, #FFFFFF 60%, #F8FAFC 100%)",
  },

  font: {
    heading: "var(--font-playfair), 'Playfair Display', Georgia, serif",
    body: "var(--font-inter), Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  // Fluid type scale (blueprint desktop sizes; clamps down for mobile-first)
  type: {
    display: "clamp(2.75rem, 6vw + 1rem, 4.5rem)", // ~72px
    h1: "clamp(2.5rem, 5vw + 1rem, 4rem)",
    h2: "clamp(2rem, 4vw + 0.5rem, 3.5rem)", // ~56px
    h3: "clamp(1.6rem, 2.5vw + 0.5rem, 2.5rem)", // ~40px
    h4: "clamp(1.35rem, 1.5vw + 0.5rem, 2rem)", // ~32px
    body: "1.125rem", // 18px
    small: "1rem", // 16px
    eyebrow: "0.8125rem",
  },

  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  // 8px base spacing scale
  space: {
    1: "8px",
    2: "16px",
    3: "24px",
    4: "32px",
    6: "48px",
    8: "64px",
    12: "96px",
    16: "128px",
    section: "clamp(72px, 10vw, 128px)",
  },

  radius: {
    sm: "12px",
    md: "20px",
    lg: "32px",
    card: "24px",
    pill: "999px",
  },

  shadow: {
    soft: "0 10px 40px rgba(8, 23, 53, 0.08)",
    glass: "0 25px 80px rgba(8, 23, 53, 0.12)",
    lift: "0 18px 50px rgba(8, 23, 53, 0.14)",
    glow: "0 12px 36px rgba(242, 140, 40, 0.35)",
    ring: "0 0 0 1px rgba(16, 61, 122, 0.06)",
  },

  layout: {
    maxWidth: "1240px",
    wide: "1440px",
    reading: "720px",
    gutter: "clamp(20px, 5vw, 64px)",
  },

  ease: {
    out: "cubic-bezier(0.22, 1, 0.36, 1)",
    inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },

  breakpoints: {
    sm: "480px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
  },

  z: {
    base: 1,
    sticky: 50,
    nav: 80,
    overlay: 90,
    modal: 100,
  },
} as const;

export type Theme = typeof theme;

// Media query helpers — usage: ${media.md`...`}
export const media = {
  sm: `@media (min-width: ${theme.breakpoints.sm})`,
  md: `@media (min-width: ${theme.breakpoints.md})`,
  lg: `@media (min-width: ${theme.breakpoints.lg})`,
  xl: `@media (min-width: ${theme.breakpoints.xl})`,
  // max-width helpers for mobile-down overrides
  belowMd: `@media (max-width: ${theme.breakpoints.md})`,
  belowLg: `@media (max-width: ${theme.breakpoints.lg})`,
  reduceMotion: `@media (prefers-reduced-motion: reduce)`,
} as const;
