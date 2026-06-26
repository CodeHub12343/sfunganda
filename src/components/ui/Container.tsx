"use client";

import styled, { css } from "styled-components";

export const Container = styled.div<{ $wide?: boolean; $narrow?: boolean }>`
  width: 100%;
  margin-inline: auto;
  padding-inline: ${({ theme }) => theme.layout.gutter};
  max-width: ${({ theme }) => theme.layout.maxWidth};

  ${({ $wide, theme }) =>
    $wide &&
    css`
      max-width: ${theme.layout.wide};
    `}
  ${({ $narrow, theme }) =>
    $narrow &&
    css`
      max-width: ${theme.layout.reading};
    `}
`;

export const Section = styled.section<{ $tone?: "soft" | "premium" | "dark" }>`
  position: relative;
  padding-block: ${({ theme }) => theme.space.section};
  background: ${({ theme, $tone }) =>
    $tone === "soft"
      ? theme.colors.bgSoft
      : $tone === "premium"
        ? theme.colors.bgPremium
        : $tone === "dark"
          ? theme.colors.bgDark
          : theme.colors.bg};
  color: ${({ theme, $tone }) =>
    $tone === "dark" ? theme.colors.onDark : theme.colors.ink};
`;
