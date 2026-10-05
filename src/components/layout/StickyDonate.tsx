"use client";

import { useEffect, useState } from "react";
import styled from "styled-components";
import { AnimatePresence, motion } from "framer-motion";
import { media } from "@/styles/theme";

// D7: the hardcoded 45% progress bar is removed. Until a verified funding
// ledger backs it (Phase 4), the sticky bar shows a plain donation CTA with
// no implied progress number.

const Bar = styled(motion.div)`
  position: fixed;
  z-index: ${({ theme }) => theme.z.sticky};
  left: 0;
  right: 0;
  bottom: 0;
  padding: 0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(14px);
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  display: flex;
  align-items: center;
  gap: 1rem;
  ${media.md} {
    left: auto;
    right: 24px;
    bottom: 24px;
    border-radius: ${({ theme }) => theme.radius.pill};
    border: 1px solid ${({ theme }) => theme.colors.border};
    box-shadow: ${({ theme }) => theme.shadow.glass};
    padding: 0.6rem 0.6rem 0.6rem 1.4rem;
  }
`;

const Copy = styled.div`
  flex: 1;
  min-width: 0;
  strong {
    display: block;
    font-size: 0.95rem;
    color: ${({ theme }) => theme.colors.trustBlue};
  }
  span {
    font-size: 0.8rem;
    color: ${({ theme }) => theme.colors.inkMuted};
  }
`;

const Donate = styled.a`
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: ${({ theme }) => theme.weight.semibold};
  font-size: 0.95rem;
  color: #fff;
  padding: 0.85rem 1.5rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.gradients.sunrise};
  box-shadow: ${({ theme }) => theme.shadow.glow};
  white-space: nowrap;
`;

// Appears after the hero scrolls away; gives an always-available donate path.
export function StickyDonate() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const past = window.scrollY > window.innerHeight * 0.9;
      const nearFooter =
        window.innerHeight + window.scrollY >
        document.body.offsetHeight - 320;
      setShow(past && !nearFooter);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <Bar
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 90, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
        >
          <Copy>
            <strong>Help build their home</strong>
            <span>Every gift brings the children closer</span>
          </Copy>
          <Donate href="/#sponsor">Donate Now →</Donate>
        </Bar>
      )}
    </AnimatePresence>
  );
}
