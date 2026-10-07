"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import NextLink from "next/link";
import styled from "styled-components";
import { AnimatePresence, motion } from "framer-motion";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { nav, exploreMenu } from "@/data/content";
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

// Mega-menu trigger + panel. The landing page only exposes six in-page
// anchors; without this, visitors have no path to published routes like
// /projects, /communities, /gallery, /reports, etc.
const ExploreWrap = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const ExploreTrigger = styled.button<{ $open: boolean }>`
  font-size: 0.95rem;
  font-weight: ${({ theme }) => theme.weight.medium};
  color: ${({ theme, $open }) => ($open ? theme.colors.trustBlue : theme.colors.inkSoft)};
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  position: relative;
  &::after {
    content: "";
    position: absolute;
    left: 0;
    bottom: -6px;
    height: 2px;
    width: ${({ $open }) => ($open ? "100%" : "0")};
    border-radius: 2px;
    background: ${({ theme }) => theme.gradients.sunrise};
    transition: width 0.3s ${({ theme }) => theme.ease.out};
  }
  &:hover,
  &:focus-visible {
    color: ${({ theme }) => theme.colors.trustBlue};
  }
  &:focus-visible {
    outline: 3px solid ${({ theme }) => theme.colors.sunriseOrange};
    outline-offset: 6px;
    border-radius: 4px;
  }
  svg {
    width: 10px;
    height: 10px;
    transition: transform 0.2s ${({ theme }) => theme.ease.out};
    transform: ${({ $open }) => ($open ? "rotate(180deg)" : "rotate(0deg)")};
  }
`;

const ExplorePanel = styled(motion.div)`
  position: absolute;
  top: calc(100% + 14px);
  left: 0;
  width: min(880px, 90vw);
  background: #fff;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.lg};
  box-shadow: ${({ theme }) => theme.shadow.lift};
  padding: 1.5rem;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.5rem;
`;

const ExploreCol = styled.div`
  h5 {
    font-size: 0.72rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.inkSoft};
    margin-bottom: 0.9rem;
  }
`;

const ExploreList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const ExploreLink = styled(NextLink)`
  display: block;
  padding: 0.55rem 0.6rem;
  border-radius: ${({ theme }) => theme.radius.md};
  text-decoration: none;
  color: ${({ theme }) => theme.colors.ink};
  transition: background 0.15s;
  strong {
    display: block;
    font-weight: ${({ theme }) => theme.weight.semibold};
    font-size: 0.95rem;
  }
  span {
    display: block;
    font-size: 0.8rem;
    color: ${({ theme }) => theme.colors.inkSoft};
    margin-top: 2px;
  }
  &:hover,
  &:focus-visible {
    background: #f4f6fb;
    color: ${({ theme }) => theme.colors.trustBlue};
  }
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.sunriseOrange};
    outline-offset: 1px;
  }
`;

const SheetGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-top: 1.5rem;
  h5 {
    font-family: ${({ theme }) => theme.font.body};
    font-size: 0.72rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.55);
    margin-bottom: 0.5rem;
    font-weight: ${({ theme }) => theme.weight.semibold};
  }
`;

// Sublinks match SheetLink exactly — same font, size, weight, spacing —
// so Our Story / Projects / Gallery all read as one list.
const SheetSubLink = styled(NextLink)`
  color: #fff;
  text-decoration: none;
  font-family: ${({ theme }) => theme.font.body};
  font-size: 1.15rem;
  font-weight: ${({ theme }) => theme.weight.semibold};
  line-height: 1.3;
  padding: 0.55rem 0;
  &:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
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
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
`;

// Dedicated "Sign in" affordance in the navbar. Staff and supporters
// alike need to find the sign-in page from the landing; without this
// the only route in is to type `/sign-in` in the URL bar. On narrow
// screens the mobile sheet carries the same link.
const SignInLink = styled(NextLink)`
  font-size: 0.95rem;
  font-weight: ${({ theme }) => theme.weight.medium};
  color: ${({ theme }) => theme.colors.inkSoft};
  text-decoration: none;
  padding: 0.5rem 0.8rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: rgba(255, 255, 255, 0.6);
  transition: color 0.2s, background 0.2s, border-color 0.2s;
  &:hover,
  &:focus-visible {
    color: ${({ theme }) => theme.colors.trustBlue};
    background: #fff;
    border-color: ${({ theme }) => theme.colors.trustBlue};
  }
  &:focus-visible {
    outline: 3px solid ${({ theme }) => theme.colors.sunriseOrange};
    outline-offset: 2px;
  }
`;

const SheetFooter = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-top: 2rem;
`;

const SheetSignIn = styled(NextLink)`
  display: block;
  width: 100%;
  text-align: center;
  padding: 0.9rem 1rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  color: #fff;
  text-decoration: none;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.3);
  font-weight: ${({ theme }) => theme.weight.medium};
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
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
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
  gap: 0;
  margin-top: 1.5rem;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
`;

// Mobile sheet links — unified typography. Previously the primary links
// used a large serif heading font while the Explore sublinks used body
// font; the two lists read as separate menus. One shared style now so
// every row in the sheet looks like part of the same list.
const SheetLink = styled(motion(NextLink))`
  font-family: ${({ theme }) => theme.font.body};
  font-size: 1.15rem;
  font-weight: ${({ theme }) => theme.weight.semibold};
  color: #fff;
  text-decoration: none;
  line-height: 1.3;
  padding: 0.55rem 0;
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
  const [exploreOpen, setExploreOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const exploreRef = useRef<HTMLDivElement | null>(null);

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

  // Close the Explore dropdown on outside click or Escape.
  useEffect(() => {
    if (!exploreOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!exploreRef.current) return;
      if (!exploreRef.current.contains(e.target as Node)) setExploreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExploreOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [exploreOpen]);

  return (
    <>
      <Header $scrolled={scrolled}>
        <Bar $scrolled={scrolled}>
          <Logo />
          <NavLinks aria-label="Primary">
            <ExploreWrap ref={exploreRef}>
              <ExploreTrigger
                type="button"
                aria-haspopup="true"
                aria-expanded={exploreOpen}
                $open={exploreOpen}
                onClick={() => setExploreOpen((v) => !v)}
              >
                Explore
                <svg viewBox="0 0 10 6" fill="none" aria-hidden>
                  <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </ExploreTrigger>
              <AnimatePresence>
                {exploreOpen && (
                  <ExplorePanel
                    role="menu"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {exploreMenu.map((group) => (
                      <ExploreCol key={group.title}>
                        <h5>{group.title}</h5>
                        <ExploreList>
                          {group.items.map((item) => (
                            <li key={item.href}>
                              <ExploreLink
                                href={item.href}
                                role="menuitem"
                                onClick={() => setExploreOpen(false)}
                              >
                                <strong>{item.label}</strong>
                                <span>{item.blurb}</span>
                              </ExploreLink>
                            </li>
                          ))}
                        </ExploreList>
                      </ExploreCol>
                    ))}
                  </ExplorePanel>
                )}
              </AnimatePresence>
            </ExploreWrap>
            {nav.map((n) => (
              <NavLink key={n.href} href={n.href}>
                {n.label}
              </NavLink>
            ))}
          </NavLinks>
          <Right>
            <DesktopCta>
              <SignInLink href="/sign-in" aria-label="Sign in to admin or supporter dashboard">
                Sign in
              </SignInLink>
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
              {exploreMenu.map((group) => (
                <SheetGroup key={group.title}>
                  <h5>{group.title}</h5>
                  {group.items.map((item) => (
                    <SheetSubLink key={item.href} href={item.href} onClick={close}>
                      {item.label}
                    </SheetSubLink>
                  ))}
                </SheetGroup>
              ))}
            </SheetLinks>
            <SheetFooter>
              <SheetSignIn href="/sign-in" onClick={close}>
                Sign in
              </SheetSignIn>
              <Button href="/#sponsor" variant="light" full>
                Donate Now
              </Button>
            </SheetFooter>
          </Sheet>
        )}
      </AnimatePresence>
    </>
  );
}
