"use client";

import styled from "styled-components";

export const SectionLabel = styled.span<{ $onDark?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.6em;
  font-family: ${({ theme }) => theme.font.body};
  font-size: ${({ theme }) => theme.type.eyebrow};
  font-weight: ${({ theme }) => theme.weight.bold};
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: ${({ theme, $onDark }) =>
    $onDark ? theme.colors.hopeGold : theme.colors.sunriseOrange};

  &::before {
    content: "";
    width: 28px;
    height: 2px;
    border-radius: 2px;
    background: ${({ theme }) => theme.gradients.sunrise};
  }
`;

export const Eyebrow = SectionLabel;
