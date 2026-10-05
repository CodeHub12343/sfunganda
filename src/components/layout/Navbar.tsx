"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import NextLink from "next/link";
import styled from "styled-components";
import { AnimatePresence, motion } from "framer-motion";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { nav } from "@/data/content";
import { media } from "@/styles/theme";

const Header = styled(motion.header)<{ $scrolled: boolean }>`
  position: fixed;
  inset: 0 0 auto 0;
  z-index: ${({ theme }) => theme.z.nav};
  display: flex;
  justify-content: center;
  padding: ${({ $scrolled }) => ($scrolled ? "12px" : "20px")}
    ${({ theme }) => theme.layout.gutter};
  transition: padding 0.35s ${({ theme }) => theme.ease.out};
`;

const Bar = styled.div<{ $scrolled: boolean }>`
  width: 100%;
  max-width: ${({ theme }) => theme.layout.wide};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: ${({ $scrolled }) => ($scrolled ? "10px 12px 10px 18px" : "8px 8px 8px 4px")};
  border-radius: ${({ theme }) => theme.radius.pill};
  transition: all 0.35s ${({ theme }) => theme.ease.out};
  background: ${({ $scrolled }) =>
    $scrolled ? "rgba(255, 255, 255, 0.82)" : "transparent"};
  backdrop-filter: ${({ $scrolled }) => ($scrolled ? "blur(16px) saturate(1.4)" : "none")};
  border: 1px solid
    ${({ theme, $scrolled }) => ($scrolled ? theme.colors.border : "transparent")};
  box-shadow: ${({ theme, $scrolled }) => ($scrolled ? theme.shadow.soft : "none")};
`;

const NavLinks = styled.nav`
  display: none;
  align-items: center;
  gap: 2rem;
  ${media.lg} {
    display: flex;
  }
`;

const NavLink = styled(NextLink)`
  font-size: 0.95rem;
  font-weight: ${({ theme }) => theme.weight.medium};
  color: ${({ theme }) => theme.colors.inkSoft};
  position: relative;
  transition: color 0.2s;
  text-decoration: none;
  &::after {
    content: "";
    position: absolute;
    left: 0;
    bottom: -6px;
    height: 2px;
    width: 0;
    border-radius: 2px;
    background: ${({ theme }) => theme.gradients.sunrise};
    transition: width 0.3s ${({ theme }) => theme.ease.out};
  }
  &:hover,
  &:focus-visible {
    color: ${({ theme }) => theme.colors.trustBlue};
  }
  &:hover::after,
  &:focus-visible::after {
    width: 100%;
  }
  &:focus-visible {
    outline: 3px solid ${({ theme }) => theme.colors.sunriseOrange};
    outline-offset: 6px;
    border-radius: 4px;
  }
`;

const Right = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const DesktopCta = styled.div`
  display: none;
  ${media.md} {
    display: block;
  }
`;

const Burger = styled.button`
  display: inline-grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.colors.trustBlue};
  border: none;
  cursor: pointer;
  ${media.lg} {
    display: none;
  }
  &:focus-visible {
    outline: 3px solid ${({ theme }) => theme.colors.sunriseOrange};
    outline-offset: 3px;
  }
  span,
  span::before,
  span::after {
    content: "";
    display: block;
    width: 20px;
    height: 2px;
    border-radius: 2px;
    background: #fff;
    position: relative;
  }
  span::before {
    position: absolute;
    top: -6px;
  }
  span::after {
    position: absolute;
    top: 6px;
  }
`;

const Sheet = styled(motion.div)`
  position: fixed;
  inset: 0;
  z-index: ${({ theme }) => theme.z.overlay};
  background: ${({ theme }) => theme.gradients.trust};
  color: #fff;
  display: flex;
  flex-direction: column;
  padding: 2rem ${({ theme }) => theme.layout.gutter};
`;

const SheetTop = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Close = styled.button`
  width: 48px;
  height: 48px;
  font-size: 1.6rem;
  color: #fff;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: rgba(255, 255, 255, 0.12);
  border: none;
  cursor: pointer;
  &:focus-visible {
    outline: 3px solid #fff;
    outline-offset: 3px;
  }
`;

const SheetLinks = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: auto;
  margin-bottom: auto;
`;

const SheetLink = styled(motion(NextLink))`
  font-family: ${({ theme }) => theme.font.heading};
  font-size: clamp(2rem, 9vw, 3rem);
  font-weight: ${({ theme }) => theme.weight.bold};
  color: #fff;
  text-decoration: none;
  &:focus-visible {
    outline: 3px solid #fff;
    outline-offset: 4px;
    border-radius: 4px;
  }
`;

// T6/T14: route-aware links, focus trap, Escape to close, aria-modal on sheet.
export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll while the sheet is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Focus management + Escape handling for the mobile sheet.
  useEffect(() => {
    if (!open) return;

    const first = sheetRef.current?.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !sheetRef.current) return;
      const focusables = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("hidden"));
      if (focusables.length === 0) return;
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    openerRef.current?.focus();
  }, []);

  return (
    <>
      <Header $scrolled={scrolled}>
        <Bar $scrolled={scrolled}>
          <Logo />
          <NavLinks aria-label="Primary">
            {nav.map((n) => (
              <NavLink key={n.href} href={n.href}>
                {n.label}
              </NavLink>
            ))}
          </NavLinks>
          <Right>
            <DesktopCta>
              <Button href="/#sponsor" variant="primary">
                Donate
              </Button>
            </DesktopCta>
            <Burger
              ref={openerRef}
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen(true)}
            >
              <span />
            </Burger>
          </Right>
        </Bar>
      </Header>

      <AnimatePresence>
        {open && (
          <Sheet
            id="mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            ref={sheetRef}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <SheetTop>
              <Logo onDark />
              <Close aria-label="Close menu" onClick={close}>
                ✕
              </Close>
            </SheetTop>
            <SheetLinks aria-label="Mobile">
              {nav.map((n, i) => (
                <SheetLink
                  key={n.href}
                  href={n.href}
                  onClick={close}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 * i + 0.1 }}
                >
                  {n.label}
                </SheetLink>
              ))}
            </SheetLinks>
            <Button href="/#sponsor" variant="light" full>
              Donate Now
            </Button>
          </Sheet>
        )}
      </AnimatePresence>
    </>
  );
}
