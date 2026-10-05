"use client";

import styled, { css } from "styled-components";

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

const toneStyles: Record<StatusTone, ReturnType<typeof css>> = {
  neutral: css`
    background: #e5e7eb;
    color: #374151;
  `,
  success: css`
    background: #dcfce7;
    color: #166534;
  `,
  warning: css`
    background: #fef3c7;
    color: #92400e;
  `,
  danger: css`
    background: #fee2e2;
    color: #991b1b;
  `,
  info: css`
    background: #dbeafe;
    color: #1e40af;
  `,
};

const Badge = styled.span<{ $tone: StatusTone }>`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  ${({ $tone }) => toneStyles[$tone]}
`;

export function StatusBadge({ tone = "neutral", children }: { tone?: StatusTone; children: React.ReactNode }) {
  return <Badge $tone={tone}>{children}</Badge>;
}
