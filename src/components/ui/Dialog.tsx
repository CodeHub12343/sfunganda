"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(7, 17, 29, 0.55);
  z-index: ${({ theme }) => theme.z.overlay};
  display: grid;
  place-items: center;
  padding: 1rem;
`;

const Panel = styled.div`
  background: #fff;
  border-radius: ${({ theme }) => theme.radius.lg};
  padding: 1.75rem;
  width: min(560px, 100%);
  box-shadow: ${({ theme }) => theme.shadow.lift};
  outline: none;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  h2 {
    font-family: ${({ theme }) => theme.font.heading};
    font-size: 1.3rem;
    color: ${({ theme }) => theme.colors.trustBlue};
    margin: 0;
  }
`;

const Close = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 999px;
  border: none;
  background: ${({ theme }) => theme.colors.bgSoft};
  cursor: pointer;
  &:focus-visible {
    outline: 3px solid ${({ theme }) => theme.colors.sunriseOrange};
    outline-offset: 2px;
  }
`;

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
};

export function Dialog({ open, onClose, title, children, initialFocusRef }: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement;
    const target =
      initialFocusRef?.current ??
      panelRef.current?.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
    target?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      (openerRef.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose, initialFocusRef]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <Backdrop onClick={(e) => (e.target === e.currentTarget ? onClose() : null)}>
      <Panel role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={panelRef}>
        <Head>
          <h2>{title}</h2>
          <Close aria-label="Close dialog" onClick={onClose}>
            ✕
          </Close>
        </Head>
        {children}
      </Panel>
    </Backdrop>,
    document.body
  );
}
