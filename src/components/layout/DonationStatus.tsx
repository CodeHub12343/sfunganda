"use client";

import { useEffect, useState } from "react";
import styled from "styled-components";
import { AnimatePresence, motion } from "framer-motion";

// Shows a dismissible banner when Stripe redirects the donor back to the site
// (?donation=success | cancelled), then cleans the query from the URL.

type Status = "success" | "cancelled" | null;

const Banner = styled(motion.div)<{ $tone: "success" | "cancelled" }>`
  position: fixed;
  z-index: ${({ theme }) => theme.z.modal};
  left: 50%;
  top: calc(env(safe-area-inset-top) + 16px);
  translate: -50%;
  width: min(560px, calc(100vw - 32px));
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.9rem 1rem 0.9rem 1.25rem;
  border-radius: ${({ theme }) => theme.radius.md};
  color: #fff;
  background: ${({ theme, $tone }) =>
    $tone === "success" ? theme.gradients.growth : theme.gradients.trust};
  box-shadow: ${({ theme }) => theme.shadow.glass};
  strong {
    display: block;
    font-size: 0.98rem;
  }
  span {
    font-size: 0.85rem;
    opacity: 0.85;
  }
`;

const Icon = styled.div`
  flex: none;
  font-size: 1.4rem;
  line-height: 1;
`;

const Close = styled.button`
  flex: none;
  margin-left: auto;
  width: 36px;
  height: 36px;
  border-radius: ${({ theme }) => theme.radius.pill};
  color: #fff;
  background: rgba(255, 255, 255, 0.16);
  cursor: pointer;
`;

export function DonationStatus() {
  const [status, setStatus] = useState<Status>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get("donation");
    if (value === "success" || value === "cancelled") {
      setStatus(value);
      // Remove the query so a refresh doesn't re-show the banner.
      params.delete("donation");
      const qs = params.toString();
      const url = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }
  }, []);

  useEffect(() => {
    if (status !== "success") return;
    const t = setTimeout(() => setStatus(null), 9000);
    return () => clearTimeout(t);
  }, [status]);

  return (
    <AnimatePresence>
      {status && (
        <Banner
          key={status}
          $tone={status}
          role="status"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
        >
          <Icon aria-hidden>{status === "success" ? "💛" : "↩️"}</Icon>
          <div>
            {status === "success" ? (
              <>
                <strong>Thank you for your gift!</strong>
                <span>Your donation is helping give children a safe, loving home.</span>
              </>
            ) : (
              <>
                <strong>Your donation was cancelled.</strong>
                <span>No charge was made — you can give whenever you're ready.</span>
              </>
            )}
          </div>
          <Close aria-label="Dismiss" onClick={() => setStatus(null)}>
            ✕
          </Close>
        </Banner>
      )}
    </AnimatePresence>
  );
}
