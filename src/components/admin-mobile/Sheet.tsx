"use client";

import styled, { keyframes, css } from "styled-components";
import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

export type SheetVariant = "bottom" | "full";

type Props = {
  open: boolean;
  onClose: () => void;
  variant?: SheetVariant;
  title?: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  labelledBy?: string;
  dismissible?: boolean;
};

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const slideUp = keyframes`
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
`;

const fadeRise = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  z-index: var(--am-z-sheet-backdrop);
  animation: ${fadeIn} var(--am-dur-base) var(--am-ease-standard);
`;

const Panel = styled.div<{ $variant: SheetVariant }>`
  position: fixed;
  z-index: var(--am-z-sheet);
  background: var(--am-surface-raised);
  color: var(--am-ink);
  display: flex;
  flex-direction: column;
  box-shadow: var(--am-shadow-3);
  max-height: 100dvh;
  outline: none;

  ${({ $variant }) =>
    $variant === "bottom"
      ? css`
          left: 0;
          right: 0;
          bottom: 0;
          border-radius: var(--am-radius-xl) var(--am-radius-xl) 0 0;
          max-height: 90dvh;
          padding-bottom: env(safe-area-inset-bottom);
          animation: ${slideUp} var(--am-dur-slow) var(--am-ease-emphasis);
        `
      : css`
          inset: 0;
          animation: ${fadeRise} var(--am-dur-base) var(--am-ease-standard);
          transform-origin: top center;
        `}

  @media (prefers-reduced-motion: reduce) {
    animation: ${fadeIn} var(--am-dur-base) var(--am-ease-standard);
  }
`;

const Grabber = styled.div`
  width: 36px;
  height: 4px;
  border-radius: var(--am-radius-pill);
  background: var(--am-border-strong);
  margin: 8px auto 0;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 8px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  line-height: 26px;
  color: var(--am-ink);
`;

const Desc = styled.p`
  margin: 0 16px 8px;
  font-size: 13px;
  line-height: 20px;
  color: var(--am-ink-muted);
`;

const Body = styled.div`
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 8px 16px 16px;
  overscroll-behavior: contain;
`;

const Footer = styled.div`
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--am-border);
  display: flex;
  gap: 8px;
`;

const CloseBtn = styled.button`
  width: 36px;
  height: 36px;
  border-radius: var(--am-radius-pill);
  border: 0;
  background: var(--am-bg-soft);
  color: var(--am-ink);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  &:focus-visible {
    outline: 2px solid var(--am-brand-500);
    outline-offset: 2px;
  }
`;

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M4 4l8 8M12 4l-8 8"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  </svg>
);

function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const panel = ref.current;
    const prevActive = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
        )
      );
    const first = focusables()[0];
    (first ?? panel).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const idx = items.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && (idx <= 0 || idx === -1)) {
        e.preventDefault();
        items[items.length - 1].focus();
      } else if (!e.shiftKey && idx === items.length - 1) {
        e.preventDefault();
        items[0].focus();
      }
    };
    panel.addEventListener("keydown", onKey);
    return () => {
      panel.removeEventListener("keydown", onKey);
      prevActive?.focus?.();
    };
  }, [active, ref]);
}

export function Sheet({
  open,
  onClose,
  variant = "bottom",
  title,
  description,
  children,
  footer,
  labelledBy,
  dismissible = true,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const descId = useRef(`am-sheet-${Math.random().toString(36).slice(2)}`).current;
  const titleId = useRef(`am-sheet-${Math.random().toString(36).slice(2)}`).current;

  useFocusTrap(panelRef, open);

  const handleKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) {
        e.stopPropagation();
        onClose();
      }
    },
    [dismissible, onClose]
  );

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <Backdrop onClick={dismissible ? onClose : undefined} aria-hidden="true" />
      <Panel
        ref={panelRef}
        $variant={variant}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? (title ? titleId : undefined)}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        onKeyDown={handleKey}
      >
        {variant === "bottom" && <Grabber aria-hidden="true" />}
        {(title || dismissible) && (
          <Header>
            {title && <Title id={titleId}>{title}</Title>}
            {dismissible && (
              <CloseBtn type="button" onClick={onClose} aria-label="Close">
                <CloseIcon />
              </CloseBtn>
            )}
          </Header>
        )}
        {description && <Desc id={descId}>{description}</Desc>}
        <Body>{children}</Body>
        {footer && <Footer>{footer}</Footer>}
      </Panel>
    </>,
    document.body
  );
}
