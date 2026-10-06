"use client";

import styled from "styled-components";

export type BadgeTone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info";

type Props = {
  tone?: BadgeTone;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

const tones: Record<BadgeTone, { bg: string; fg: string; border: string }> = {
  neutral: { bg: "var(--am-bg-soft)", fg: "var(--am-ink-muted)", border: "var(--am-border)" },
  brand: { bg: "var(--am-brand-50)", fg: "var(--am-brand-600)", border: "var(--am-brand-50)" },
  success: { bg: "var(--am-success-50)", fg: "var(--am-success-600)", border: "var(--am-success-50)" },
  warning: { bg: "var(--am-warning-50)", fg: "var(--am-warning-600)", border: "var(--am-warning-50)" },
  danger: { bg: "var(--am-danger-50)", fg: "var(--am-danger-600)", border: "var(--am-danger-50)" },
  info: { bg: "var(--am-info-50)", fg: "var(--am-info-600)", border: "var(--am-info-50)" },
};

const Root = styled.span<{ $tone: BadgeTone }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  min-height: 20px;
  border-radius: var(--am-radius-pill);
  background: ${({ $tone }) => tones[$tone].bg};
  color: ${({ $tone }) => tones[$tone].fg};
  border: 1px solid ${({ $tone }) => tones[$tone].border};
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
  & svg {
    width: 12px;
    height: 12px;
  }
`;

export function Badge({ tone = "neutral", icon, children, className }: Props) {
  return (
    <Root $tone={tone} className={className}>
      {icon}
      <span>{children}</span>
    </Root>
  );
}
