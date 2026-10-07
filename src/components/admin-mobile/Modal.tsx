"use client";

import styled, { keyframes } from "styled-components";
import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  dismissible?: boolean;
};

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const scaleIn = keyframes`
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
`;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  z-index: var(--am-z-modal-backdrop);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: ${fadeIn} var(--am-dur-base) var(--am-ease-standard);
`;

const sizes = { sm: "360px", md: "480px", lg: "640px" };

const Panel = styled.div<{ $size: "sm" | "md" | "lg" }>`
  position: relative;
  z-index: var(--am-z-modal);
  background: var(--am-surface-raised);
  color: var(--am-ink);
  border-radius: var(--am-radius-xl);
  box-shadow: var(--am-shadow-3);
  width: 100%;
  max-width: ${({ $size }) => sizes[$size]};
  max-height: 90dvh;
  display: flex;
  flex-direction: column;
  outline: none;
  animation: ${scaleIn} var(--am-dur-base) var(--am-ease-emphasis);
`;

const Header = styled.div`
  padding: 20px 20px 8px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  line-height: 26px;
`;

const Desc = styled.p`
  margin: 4px 0 0;
  font-size: 14px;
  line-height: 20px;
  color: var(--am-ink-muted);
`;

const Body = styled.div`
  padding: 12px 20px;
  overflow-y: auto;
  flex: 1 1 auto;
`;

const Footer = styled.div`
  padding: 12px 20px 20px;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
`;

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  dismissible = true,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useRef(`am-modal-${Math.random().toString(36).slice(2)}`).current;
  const descId = useRef(`am-modal-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusables = () =>
      panel
        ? Array.from(
            panel.querySelectorAll<HTMLElement>(
              'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
            )
          )
        : [];
    (focusables()[0] ?? panel)?.focus();

    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (!panel) return;
      if (e.key === "Escape" && dismissible) {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab") {
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
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = bodyOverflow;
      prev?.focus?.();
    };
  }, [open, dismissible, onClose]);

  const onBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && dismissible) onClose();
    },
    [dismissible, onClose]
  );

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <Backdrop onMouseDown={onBackdropClick}>
      <Panel
        ref={panelRef}
        $size={size}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
      >
        {(title || description) && (
          <Header>
            {title && <Title id={titleId}>{title}</Title>}
            {description && <Desc id={descId}>{description}</Desc>}
          </Header>
        )}
        <Body>{children}</Body>
        {footer && <Footer>{footer}</Footer>}
      </Panel>
    </Backdrop>,
    document.body
  );
}
