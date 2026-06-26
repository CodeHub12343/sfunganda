"use client";

import { createGlobalStyle } from "styled-components";

export const GlobalStyles = createGlobalStyle`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  * {
    margin: 0;
    padding: 0;
  }

  :root {
    --max-width: ${({ theme }) => theme.layout.maxWidth};
    --gutter: ${({ theme }) => theme.layout.gutter};
    color-scheme: light;
  }

  html {
    -webkit-text-size-adjust: 100%;
    scroll-behavior: smooth;
    /* Robust safety net: clip any stray horizontal overflow without
       creating a scroll container (unlike overflow: hidden). */
    overflow-x: clip;
  }

  ${({ theme }) => theme.ease && ""}

  @media (prefers-reduced-motion: reduce) {
    html {
      scroll-behavior: auto;
    }
    *,
    *::before,
    *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
      scroll-behavior: auto !important;
    }
  }

  body {
    font-family: ${({ theme }) => theme.font.body};
    font-size: ${({ theme }) => theme.type.body};
    line-height: 1.65;
    color: ${({ theme }) => theme.colors.ink};
    background: ${({ theme }) => theme.colors.bg};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    overflow-x: clip;
    max-width: 100%;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: ${({ theme }) => theme.font.heading};
    line-height: 1.08;
    letter-spacing: -0.02em;
    color: ${({ theme }) => theme.colors.trustBlue};
    font-weight: ${({ theme }) => theme.weight.bold};
    text-wrap: balance;
  }

  p {
    text-wrap: pretty;
  }

  a {
    color: inherit;
    text-decoration: none;
  }

  button {
    font-family: inherit;
    cursor: pointer;
    border: none;
    background: none;
  }

  ul, ol {
    list-style: none;
  }

  img, picture, svg, video, canvas {
    display: block;
    max-width: 100%;
  }

  input, textarea, select {
    font: inherit;
    color: inherit;
  }

  ::selection {
    background: ${({ theme }) => theme.colors.hopeGold};
    color: ${({ theme }) => theme.colors.trustBlue};
  }

  :focus-visible {
    outline: 3px solid ${({ theme }) => theme.colors.sunriseOrange};
    outline-offset: 3px;
    border-radius: 4px;
  }

  /* Custom, subtle scrollbar */
  ::-webkit-scrollbar {
    width: 12px;
  }
  ::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.borderStrong};
    border-radius: 999px;
    border: 3px solid ${({ theme }) => theme.colors.bg};
  }
`;
