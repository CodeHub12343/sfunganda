"use client";

import { useMemo, useState } from "react";
import styled from "styled-components";
import { AnimatePresence, motion } from "framer-motion";
import { Container, Section } from "@/components/ui/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Reveal } from "@/components/ui/Reveal";
import { sponsorTiers } from "@/data/content";
import { media } from "@/styles/theme";

const Grid = styled.div`
  display: grid;
  gap: 3rem;
  align-items: center;
  grid-template-columns: 1fr;
  ${media.lg} {
    grid-template-columns: 0.9fr 1.1fr;
  }
`;

const Intro = styled.div`
  h2 {
    font-size: ${({ theme }) => theme.type.h2};
    margin: 1rem 0 1.25rem;
  }
  p {
    color: ${({ theme }) => theme.colors.inkSoft};
    max-width: 46ch;
  }
`;

const Toggle = styled.div`
  display: inline-flex;
  margin-top: 1.75rem;
  padding: 4px;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.colors.bgSoft};
  border: 1px solid ${({ theme }) => theme.colors.border};
`;

const ToggleBtn = styled.button<{ $active: boolean }>`
  position: relative;
  padding: 0.6rem 1.4rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  font-weight: ${({ theme }) => theme.weight.semibold};
  font-size: 0.9rem;
  color: ${({ theme, $active }) =>
    $active ? "#fff" : theme.colors.inkSoft};
  z-index: 1;
`;

const Slider = styled(motion.span)`
  position: absolute;
  inset: 4px;
  width: calc(50% - 4px);
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.gradients.sunrise};
  box-shadow: ${({ theme }) => theme.shadow.glow};
  z-index: 0;
`;

const ToggleInner = styled.div`
  position: relative;
  display: flex;
`;

const Panel = styled.div`
  padding: 1.5rem;
  border-radius: ${({ theme }) => theme.radius.lg};
  background: ${({ theme }) => theme.colors.bg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.shadow.glass};
  overflow: hidden;
  ${media.sm} {
    padding: 2rem;
  }
  ${media.md} {
    padding: 2.5rem;
  }
`;

const Tiers = styled.div`
  display: grid;
  gap: 0.6rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  ${media.sm} {
    gap: 0.85rem;
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
`;

const Tier = styled.button<{ $active: boolean; $featured?: boolean }>`
  position: relative;
  padding: 1.1rem 0.4rem;
  border-radius: ${({ theme }) => theme.radius.md};
  font-family: ${({ theme }) => theme.font.heading};
  font-size: clamp(1.1rem, 5.5vw, 1.5rem);
  font-weight: ${({ theme }) => theme.weight.bold};
  color: ${({ theme, $active }) => ($active ? "#fff" : theme.colors.trustBlue)};
  background: ${({ theme, $active }) =>
    $active ? theme.gradients.trust : theme.colors.bgSoft};
  border: 1.5px solid
    ${({ theme, $active }) =>
      $active ? theme.colors.trustBlue : theme.colors.border};
  transition: all 0.25s ${({ theme }) => theme.ease.out};
  &:hover {
    border-color: ${({ theme }) => theme.colors.sunriseOrange};
  }
`;

const Badge = styled.span`
  position: absolute;
  top: -10px;
  left: 50%;
  translate: -50%;
  max-width: 90%;
  font-family: ${({ theme }) => theme.font.body};
  font-size: 0.56rem;
  font-weight: ${({ theme }) => theme.weight.bold};
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 3px 7px;
  border-radius: 999px;
  color: #fff;
  background: ${({ theme }) => theme.gradients.sunrise};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  ${media.sm} {
    font-size: 0.62rem;
    letter-spacing: 0.1em;
    padding: 3px 8px;
  }
`;

const CustomRow = styled.div`
  margin-top: 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.5rem 0.5rem 1.1rem;
  border-radius: ${({ theme }) => theme.radius.md};
  border: 1.5px dashed ${({ theme }) => theme.colors.borderStrong};
  label {
    font-size: 0.9rem;
    color: ${({ theme }) => theme.colors.inkMuted};
    white-space: nowrap;
  }
  span {
    font-size: 1.3rem;
    font-weight: ${({ theme }) => theme.weight.bold};
    color: ${({ theme }) => theme.colors.trustBlue};
  }
  input {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    font-family: ${({ theme }) => theme.font.heading};
    font-size: 1.4rem;
    font-weight: ${({ theme }) => theme.weight.bold};
    color: ${({ theme }) => theme.colors.trustBlue};
    outline: none;
    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
      appearance: none;
      margin: 0;
    }
  }
`;

const Impact = styled(motion.div)`
  margin-top: 1.5rem;
  padding: 1.5rem;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.warmCream};
  border: 1px solid ${({ theme }) => theme.colors.border};
  display: flex;
  gap: 1rem;
  align-items: flex-start;
`;

const ImpactIcon = styled.div`
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: ${({ theme }) => theme.gradients.sunrise};
  color: #fff;
`;

const ImpactText = styled.div`
  strong {
    display: block;
    color: ${({ theme }) => theme.colors.trustBlue};
    font-size: 1.05rem;
  }
  span {
    color: ${({ theme }) => theme.colors.inkSoft};
    font-size: 0.95rem;
  }
`;

const Submit = styled.div`
  margin-top: 1.5rem;
`;

// Donation is an action (not navigation), so this is a real <button> styled to
// match the primary Button variant.
const GiveButton = styled(motion.button)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.6em;
  width: 100%;
  min-height: 52px;
  padding: 1.05rem 1.9rem;
  font-family: ${({ theme }) => theme.font.body};
  font-weight: ${({ theme }) => theme.weight.semibold};
  font-size: ${({ theme }) => theme.type.small};
  color: #fff;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.gradients.sunrise};
  box-shadow: ${({ theme }) => theme.shadow.glow};
  cursor: pointer;
  transition: box-shadow 0.3s ${({ theme }) => theme.ease.out};
  &:hover {
    box-shadow: 0 18px 48px rgba(242, 140, 40, 0.45);
  }
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const Reassure = styled.p`
  margin-top: 1rem;
  text-align: center;
  font-size: 0.82rem;
  color: ${({ theme }) => theme.colors.inkMuted};
`;

const ErrorNote = styled.p`
  margin-top: 0.85rem;
  text-align: center;
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.attention};
`;

export function SponsorChild() {
  const [monthly, setMonthly] = useState(true);
  const [amount, setAmount] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDonate() {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/donations/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ amount, monthly }),
      });
      const payload = (await res.json()) as {
        data?: { url?: string };
        error?: { code?: string; message?: string };
      };
      const url = payload.data?.url;
      if (!res.ok || !url) {
        // 503 "unavailable" means the Stripe key isn't configured on the
        // server — tell the donor so, instead of a generic failure.
        if (res.status === 503 || payload.error?.code === "unavailable") {
          throw new Error(
            "Our donation processor isn't available right now. Please try again shortly, or email us at hello@sfuganda.com and we'll process your gift directly."
          );
        }
        throw new Error(payload.error?.message || "Could not start checkout.");
      }
      const data = { url };
      // Hand off to Stripe's hosted, PCI-compliant Checkout page.
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  const tier = useMemo(() => {
    // closest tier at or below the chosen amount, else the smallest
    const sorted = [...sponsorTiers].sort((a, b) => b.amount - a.amount);
    return sorted.find((t) => amount >= t.amount) ?? sponsorTiers[0];
  }, [amount]);

  // D9: no invented ratios ("meals for amount ÷ 2 children"). Each tier maps
  // to a stakeholder-approved description of what the gift supports. Real
  // per-dollar cost data replaces this in Phase 4 when the ledger is in place.
  const impactCopy = useMemo(() => {
    if (amount >= 250) return "helps build the permanent family home.";
    if (amount >= 100) return "goes toward tuition, books, and school materials.";
    if (amount >= 50) return "supports medical care and daily living for a child.";
    if (amount >= 25) return "contributes to meals and school supplies.";
    return "contributes to meals and daily care for the children.";
  }, [amount]);

  return (
    <Section id="sponsor" $tone="premium">
      <Container $wide>
        <Grid>
          <Intro>
            <Reveal>
              <SectionLabel>Sponsor a Child</SectionLabel>
              <h2>See your impact before you give.</h2>
              <p>
                Choose an amount and watch exactly what it makes possible. This
                isn&apos;t a transaction — it&apos;s the start of someone&apos;s
                future.
              </p>
              <Toggle role="radiogroup" aria-label="Donation frequency">
                <ToggleInner>
                  <Slider
                    animate={{ x: monthly ? 0 : "100%" }}
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                  <ToggleBtn
                    type="button"
                    role="radio"
                    aria-checked={monthly}
                    $active={monthly}
                    onClick={() => setMonthly(true)}
                  >
                    Monthly
                  </ToggleBtn>
                  <ToggleBtn
                    type="button"
                    role="radio"
                    aria-checked={!monthly}
                    $active={!monthly}
                    onClick={() => setMonthly(false)}
                  >
                    One-time
                  </ToggleBtn>
                </ToggleInner>
              </Toggle>
            </Reveal>
          </Intro>

          <Reveal delay={0.1}>
            <Panel>
              <Tiers>
                {sponsorTiers.map((t) => (
                  <Tier
                    key={t.amount}
                    $active={amount === t.amount}
                    $featured={t.featured}
                    onClick={() => setAmount(t.amount)}
                    aria-pressed={amount === t.amount}
                  >
                    {t.featured && <Badge>Most loved</Badge>}${t.amount}
                  </Tier>
                ))}
              </Tiers>

              <CustomRow>
                <label htmlFor="custom-amount">Custom</label>
                <span>$</span>
                <input
                  id="custom-amount"
                  type="number"
                  min={1}
                  step={0.01}
                  value={amount}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setAmount(Number.isFinite(next) && next >= 1 ? next : 1);
                  }}
                  aria-label="Custom donation amount in dollars"
                />
              </CustomRow>

              <AnimatePresence mode="wait">
                <Impact
                  key={impactCopy}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <ImpactIcon>
                    <HeartIcon />
                  </ImpactIcon>
                  <ImpactText>
                    <strong>Your impact</strong>
                    <span>
                      ${amount}
                      {monthly ? "/month" : " today"} {impactCopy}
                    </span>
                  </ImpactText>
                </Impact>
              </AnimatePresence>

              <Submit>
                <GiveButton
                  type="button"
                  onClick={handleDonate}
                  disabled={loading}
                  whileHover={loading ? undefined : { y: -3 }}
                  whileTap={loading ? undefined : { scale: 0.97, y: -1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 22 }}
                >
                  {loading ? (
                    "Redirecting to secure checkout…"
                  ) : (
                    <>
                      Give ${amount}
                      {monthly ? " every month" : " now"} →
                    </>
                  )}
                </GiveButton>
              </Submit>
              {error && <ErrorNote role="alert">{error}</ErrorNote>}
              <Reassure>
                🔒 Secure payment via Stripe · Cancel anytime ·
                {" "}
                <span style={{ whiteSpace: "nowrap" }}>{tier.title}</span>
              </Reassure>
            </Panel>
          </Reveal>
        </Grid>
      </Container>
    </Section>
  );
}

function HeartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 21s-7-4.6-9.3-9C1.2 8.7 2.7 5 6 5c2 0 3.2 1.2 4 2.4C10.8 6.2 12 5 14 5c3.3 0 4.8 3.7 3.3 7-2.3 4.4-9.3 9-9.3 9Z" />
    </svg>
  );
}
