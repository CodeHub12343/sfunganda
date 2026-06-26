"use client";

import { useEffect, useState } from "react";
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

const NavLink = styled.a`
  font-size: 0.95rem;
  font-weight: ${({ theme }) => theme.weight.medium};
  color: ${({ theme }) => theme.colors.inkSoft};
  position: relative;
  transition: color 0.2s;
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
  &:hover {
    color: ${({ theme }) => theme.colors.trustBlue};
  }
  &:hover::after {
    width: 100%;
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
  ${media.lg} {
    display: none;
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
`;

const SheetLinks = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: auto;
  margin-bottom: auto;
`;

const SheetLink = styled(motion.a)`
  font-family: ${({ theme }) => theme.font.heading};
  font-size: clamp(2rem, 9vw, 3rem);
  font-weight: ${({ theme }) => theme.weight.bold};
  color: #fff;
`;

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

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
              <Button href="#sponsor" variant="primary">
                Donate
              </Button>
            </DesktopCta>
            <Burger aria-label="Open menu" onClick={() => setOpen(true)}>
              <span />
            </Burger>
          </Right>
        </Bar>
      </Header>

      <AnimatePresence>
        {open && (
          <Sheet
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <SheetTop>
              <Logo onDark />
              <Close aria-label="Close menu" onClick={() => setOpen(false)}>
                ✕
              </Close>
            </SheetTop>
            <SheetLinks aria-label="Mobile">
              {nav.map((n, i) => (
                <SheetLink
                  key={n.href}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 * i + 0.1 }}
                >
                  {n.label}
                </SheetLink>
              ))}
            </SheetLinks>
            <Button href="#sponsor" variant="light" full onClick={() => setOpen(false)}>
              Donate Now
            </Button>
          </Sheet>
        )}
      </AnimatePresence>
    </>
  );
}
