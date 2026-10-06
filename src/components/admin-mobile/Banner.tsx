"use client";

import styled from "styled-components";
import { useState } from "react";

export type BannerTone = "info" | "success" | "warning" | "danger";

type Props = {
  tone?: BannerTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  icon?: React.ReactNode;
};

const tones: Record<BannerTone, { bg: string; fg: string; stripe: string }> = {
  info: { bg: "var(--am-info-50)", fg: "var(--am-info-600)", stripe: "var(--am-info-600)" },
  success: { bg: "var(--am-success-50)", fg: "var(--am-success-600)", stripe: "var(--am-success-600)" },
  warning: { bg: "var(--am-warning-50)", fg: "var(--am-warning-600)", stripe: "var(--am-warning-600)" },
  danger: { bg: "var(--am-danger-50)", fg: "var(--am-danger-600)", stripe: "var(--am-danger-600)" },
};

const Root = styled.div<{ $tone: BannerTone }>`
  position: relative;
  display: flex;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--am-radius-md);
  background: ${({ $tone }) => tones[$tone].bg};
  color: var(--am-ink);
  border: 1px solid ${({ $tone }) => tones[$tone].fg};
  border-left-width: 4px;
`;

const IconWrap = styled.div<{ $tone: BannerTone }>`
  color: ${({ $tone }) => tones[$tone].fg};
  flex-shrink: 0;
  padding-top: 2px;
`;

const Body = styled.div`
  flex: 1 1 auto;
  min-width: 0;
`;

const Title = styled.div`
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  color: var(--am-ink);
`;

const Text = styled.div`
  font-size: 14px;
  line-height: 20px;
  color: var(--am-ink-muted);
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
`;

const Dismiss = styled.button`
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: 0;
  background: transparent;
  color: var(--am-ink-muted);
  border-radius: var(--am-radius-pill);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  &:hover {
    background: rgba(0, 0, 0, 0.06);
  }
  &:focus-visible {
    outline: 2px solid var(--am-brand-500);
    outline-offset: 2px;
  }
`;

const defaultIcons: Record<BannerTone, React.ReactNode> = {
  info: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M10 9v5M10 6v.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  ),
  success: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="m6.5 10 2.5 2.5L14 8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  warning: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="m10 2 8.5 15h-17z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M10 8v4M10 14v.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  ),
  danger: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="m7 7 6 6M13 7l-6 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  ),
};

export function Banner({
  tone = "info",
  title,
  children,
  action,
  dismissible = false,
  onDismiss,
  icon,
}: Props) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const dismiss = () => {
    setOpen(false);
    onDismiss?.();
  };
  return (
    <Root $tone={tone} role={tone === "danger" ? "alert" : "status"}>
      <IconWrap $tone={tone}>{icon ?? defaultIcons[tone]}</IconWrap>
      <Body>
        {title && <Title>{title}</Title>}
        {children && <Text>{children}</Text>}
        {action && <Actions>{action}</Actions>}
      </Body>
      {dismissible && (
        <Dismiss type="button" onClick={dismiss} aria-label="Dismiss">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M3 3l8 8M11 3l-8 8"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </Dismiss>
      )}
    </Root>
  );
}
