"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styled from "styled-components";
import { api, ApiClientError } from "@/lib/api";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";

export const dynamic = "force-dynamic";

type Donation = {
  _id: string;
  public_id: string;
  gross_source_cents: number;
  source_currency: string;
  gross_base_cents: number;
  base_currency: string;
  received_at: string;
  status: string;
  recurring: boolean;
};

function money(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function statusTone(status: string): "success" | "warn" | "muted" {
  const s = status.toLowerCase();
  if (s.includes("success") || s.includes("completed") || s.includes("received")) return "success";
  if (s.includes("pending") || s.includes("process")) return "warn";
  return "muted";
}

export default function DonationsPage() {
  const toast = useToast();
  const [data, setData] = useState<{ items: Donation[]; unverified: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<{ items: Donation[]; unverified: boolean }>("/me/donations"));
    } catch (e) {
      setErr((e as ApiClientError).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Claim-a-donation state.
  const [claimRef, setClaimRef] = useState("");
  const [claimCode, setClaimCode] = useState("");
  const [claimStage, setClaimStage] = useState<"idle" | "code_sent" | "sending" | "verifying">("idle");
  const [claimHint, setClaimHint] = useState<string>("");

  async function sendClaimCode() {
    const trimmed = claimRef.trim();
    if (!trimmed) return;
    setClaimStage("sending");
    try {
      const r = await api<{ sent_hint: string }>("/me/donations/claim", {
        json: { public_id: trimmed },
      });
      setClaimHint(r.sent_hint);
      setClaimStage("code_sent");
      toast.push({
        tone: "success",
        message: `If this reference is valid, a 6‑digit code was sent to ${r.sent_hint}.`,
      });
    } catch (e) {
      setClaimStage("idle");
      toast.push({ tone: "danger", message: (e as ApiClientError).message });
    }
  }

  async function verifyClaim() {
    const trimmed = claimRef.trim();
    const code = claimCode.trim();
    if (!/^\d{6}$/.test(code)) {
      toast.push({ tone: "danger", message: "Enter the 6-digit code." });
      return;
    }
    setClaimStage("verifying");
    try {
      await api("/me/donations/claim/verify", {
        json: { public_id: trimmed, code },
      });
      toast.push({ tone: "success", message: "Donation linked to your account." });
      setClaimRef("");
      setClaimCode("");
      setClaimHint("");
      setClaimStage("idle");
      void load();
    } catch (e) {
      setClaimStage("code_sent");
      toast.push({ tone: "danger", message: (e as ApiClientError).message });
    }
  }

  function resetClaim() {
    setClaimStage("idle");
    setClaimCode("");
    setClaimHint("");
  }

  const stats = useMemo(() => {
    if (!data?.items?.length) return null;
    const totalCents = data.items.reduce((a, d) => a + d.gross_base_cents, 0);
    const recurring = data.items.filter((d) => d.recurring).length;
    const currency = data.items[0].base_currency;
    const last = data.items[0];
    return { totalCents, recurring, currency, last };
  }, [data]);

  if (err) return <ErrorState message={err} />;
  if (!data) return <LoadingState />;

  if (data.unverified) {
    return (
      <Page>
        <Header>
          <Eyebrow>Giving</Eyebrow>
          <Title>Your donations</Title>
        </Header>
        <VerifyCard>
          <strong>Please confirm your email to see your donation history.</strong>
          <p>
            For your privacy we only link donations to a verified email address. Need a new
            verification link? Request one from{" "}
            <Link href="/supporters/verify">the verification page</Link>.
          </p>
        </VerifyCard>
      </Page>
    );
  }

  return (
    <Page>
      <Header>
        <HeaderText>
          <Eyebrow>Giving</Eyebrow>
          <Title>Your donations</Title>
          <Lede>
            Receipts, recurring gifts, and lifetime totals from every donation linked to
            your verified email.
          </Lede>
        </HeaderText>
        <HeaderCta href="/#sponsor">Make another gift</HeaderCta>
      </Header>

      {stats ? (
        <StatGrid>
          <StatCard accent="blue">
            <StatLabel>Lifetime giving</StatLabel>
            <StatValue>{money(stats.totalCents, stats.currency)}</StatValue>
            <StatHint>Across {data.items.length} donations</StatHint>
          </StatCard>
          <StatCard accent="gold">
            <StatLabel>Recurring gifts</StatLabel>
            <StatValue>{stats.recurring}</StatValue>
            <StatHint>Active or past monthly commitments</StatHint>
          </StatCard>
          <StatCard accent="green">
            <StatLabel>Most recent</StatLabel>
            <StatValue>
              {money(stats.last.gross_source_cents, stats.last.source_currency)}
            </StatValue>
            <StatHint>{new Date(stats.last.received_at).toLocaleDateString()}</StatHint>
          </StatCard>
          <StatCard accent="orange">
            <StatLabel>Reference</StatLabel>
            <StatValue style={{ fontFamily: "monospace", fontSize: "1.1rem" }}>
              {stats.last.public_id}
            </StatValue>
            <StatHint>Latest receipt ID</StatHint>
          </StatCard>
        </StatGrid>
      ) : null}

      <ClaimCard>
        <ClaimHead>
          <h2>Claim a past donation</h2>
          <p>
            If you donated under a different email, enter the reference from your
            receipt (<code>DON-YYYY-#####</code>). We&apos;ll send a one‑time code to
            the email on that receipt so you can attach the donation to your account.
          </p>
        </ClaimHead>
        {claimStage === "idle" || claimStage === "sending" ? (
          <ClaimRow>
            <Input
              value={claimRef}
              onChange={(e) => setClaimRef(e.target.value.toUpperCase())}
              placeholder="DON-2026-00042"
              aria-label="Donation reference"
            />
            <PrimaryBtn
              type="button"
              onClick={sendClaimCode}
              disabled={claimStage === "sending" || !claimRef.trim()}
            >
              {claimStage === "sending" ? "Sending…" : "Send code"}
            </PrimaryBtn>
          </ClaimRow>
        ) : (
          <>
            <Hint>
              Enter the 6-digit code we sent to <strong>{claimHint}</strong>.
            </Hint>
            <ClaimRow>
              <Input
                value={claimCode}
                onChange={(e) => setClaimCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                aria-label="6-digit code"
              />
              <PrimaryBtn
                type="button"
                onClick={verifyClaim}
                disabled={claimStage === "verifying" || claimCode.length !== 6}
              >
                {claimStage === "verifying" ? "Linking…" : "Link donation"}
              </PrimaryBtn>
            </ClaimRow>
            <GhostLink type="button" onClick={resetClaim}>
              Use a different reference
            </GhostLink>
          </>
        )}
      </ClaimCard>

      {data.items.length === 0 ? (
        <EmptyState
          title="No donations yet"
          description="When you give, your acknowledgements will appear here."
        />
      ) : (
        <HistoryCard>
          <HistoryHead>
            <h2>Donation history</h2>
            <small>{data.items.length} total</small>
          </HistoryHead>

          <List>
            {data.items.map((d) => {
              const tone = statusTone(d.status);
              return (
                <Row key={d._id}>
                  <RowMain>
                    <Ref>{d.public_id}</Ref>
                    <DateText>{new window.Date(d.received_at).toLocaleDateString()}</DateText>
                    {d.recurring ? <Chip>Monthly</Chip> : null}
                  </RowMain>
                  <RowAmount>
                    {money(d.gross_source_cents, d.source_currency)}
                  </RowAmount>
                  <StatusBadge $tone={tone}>{d.status.replace(/_/g, " ")}</StatusBadge>
                </Row>
              );
            })}
          </List>
        </HistoryCard>
      )}
    </Page>
  );
}

/* ===================== styles ===================== */

const Page = styled.section`
  display: grid;
  gap: 1.5rem;
`;

const Header = styled.div`
  display: grid;
  gap: 0.75rem;

  @media (min-width: 768px) {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
  }
`;

const HeaderText = styled.div`
  display: grid;
  gap: 0.3rem;
`;

const Eyebrow = styled.div`
  font-size: 0.74rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.sunriseOrange};
  font-weight: 700;
`;

const Title = styled.h1`
  font-family: ${({ theme }) => theme.font.heading};
  font-size: clamp(1.6rem, 2vw + 1rem, 2.2rem);
  margin: 0;
  color: ${({ theme }) => theme.colors.trustBlue};
`;

const Lede = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.inkSoft};
  font-size: 0.95rem;
  max-width: 56ch;
`;

const HeaderCta = styled(Link)`
  display: inline-flex;
  align-items: center;
  padding: 0.65rem 1.1rem;
  border-radius: 999px;
  background: ${({ theme }) => theme.gradients.sunrise};
  color: #1a0f00;
  font-weight: 700;
  font-size: 0.9rem;
  text-decoration: none;
  box-shadow: ${({ theme }) => theme.shadow.glow};
  width: fit-content;
`;

const StatGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
  width: 100%;

  @media (min-width: 1024px) {
    gap: 1rem;
  }
`;

type Accent = "blue" | "gold" | "green" | "orange";
const accentColor: Record<Accent, string> = {
  blue: "#103D7A",
  gold: "#F7B733",
  green: "#3D8B37",
  orange: "#F28C28",
};

const StatCard = styled.div<{ accent: Accent }>`
  position: relative;
  padding: 1rem 1.1rem 1.1rem;
  border-radius: ${({ theme }) => theme.radius.md};
  background: #fff;
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.shadow.ring};
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    background: ${({ accent }) => accentColor[accent]};
  }
`;

const StatLabel = styled.div`
  color: ${({ theme }) => theme.colors.inkMuted};
  font-size: 0.76rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
`;

const StatValue = styled.div`
  font-family: ${({ theme }) => theme.font.heading};
  font-size: clamp(1.25rem, 1.5vw + 0.5rem, 1.6rem);
  font-weight: 700;
  color: ${({ theme }) => theme.colors.trustBlue};
  margin: 0.3rem 0 0.2rem;
  line-height: 1.15;
  word-break: break-word;
`;

const StatHint = styled.div`
  color: ${({ theme }) => theme.colors.inkMuted};
  font-size: 0.78rem;
`;

const HistoryCard = styled.section`
  background: #fff;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  box-shadow: ${({ theme }) => theme.shadow.ring};
  overflow: hidden;
`;

const HistoryHead = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  h2 {
    margin: 0;
    font-family: ${({ theme }) => theme.font.heading};
    font-size: 1.05rem;
    color: ${({ theme }) => theme.colors.trustBlue};
  }

  small {
    color: ${({ theme }) => theme.colors.inkMuted};
    font-size: 0.82rem;
  }
`;

const List = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const Row = styled.li`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 0.75rem;
  align-items: center;
  padding: 0.9rem 1.25rem;
  border-top: 1px solid ${({ theme }) => theme.colors.border};

  &:first-child {
    border-top: none;
  }

  @media (max-width: 480px) {
    grid-template-columns: 1fr auto;
    row-gap: 0.4rem;
  }
`;

const RowMain = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
`;

const Ref = styled.span`
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.82rem;
  color: ${({ theme }) => theme.colors.trustBlue};
  background: rgba(16, 61, 122, 0.07);
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
`;

const DateText = styled.span`
  color: ${({ theme }) => theme.colors.inkSoft};
  font-size: 0.86rem;
`;

const Chip = styled.span`
  color: ${({ theme }) => theme.colors.sunriseOrange};
  background: rgba(242, 140, 40, 0.1);
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const RowAmount = styled.div`
  font-weight: 700;
  font-family: ${({ theme }) => theme.font.heading};
  color: ${({ theme }) => theme.colors.trustBlue};
  font-size: 1rem;
  text-align: right;
`;

const StatusBadge = styled.span<{ $tone: "success" | "warn" | "muted" }>`
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 600;
  text-transform: capitalize;

  background: ${({ $tone }) =>
    $tone === "success"
      ? "rgba(34, 197, 94, 0.12)"
      : $tone === "warn"
        ? "rgba(245, 158, 11, 0.14)"
        : "rgba(107, 122, 147, 0.14)"};
  color: ${({ $tone }) =>
    $tone === "success" ? "#15803D" : $tone === "warn" ? "#B45309" : "#41506A"};
`;

const ClaimCard = styled.section`
  background: #fff;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-left: 4px solid ${({ theme }) => theme.colors.sunriseOrange};
  border-radius: ${({ theme }) => theme.radius.md};
  box-shadow: ${({ theme }) => theme.shadow.ring};
  padding: 1.25rem 1.3rem;
  display: grid;
  gap: 0.85rem;
`;

const ClaimHead = styled.div`
  display: grid;
  gap: 0.3rem;

  h2 {
    margin: 0;
    font-family: ${({ theme }) => theme.font.heading};
    font-size: 1.05rem;
    color: ${({ theme }) => theme.colors.trustBlue};
  }

  p {
    margin: 0;
    color: ${({ theme }) => theme.colors.inkMuted};
    font-size: 0.86rem;
    line-height: 1.5;
  }

  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    background: ${({ theme }) => theme.colors.bgSoft};
    padding: 0.05rem 0.4rem;
    border-radius: 4px;
    font-size: 0.82rem;
  }
`;

const ClaimRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.5rem;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const Input = styled.input`
  padding: 0.6rem 0.8rem;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: #fff;
  color: ${({ theme }) => theme.colors.ink};
  font-size: 0.95rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.04em;

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.sunriseOrange};
    outline-offset: 1px;
    border-color: ${({ theme }) => theme.colors.trustBlue};
  }
`;

const PrimaryBtn = styled.button`
  appearance: none;
  border: none;
  cursor: pointer;
  padding: 0.6rem 1.2rem;
  border-radius: 999px;
  background: ${({ theme }) => theme.gradients.sunrise};
  color: #1a0f00;
  font-weight: 700;
  font-size: 0.88rem;
  box-shadow: ${({ theme }) => theme.shadow.glow};
  white-space: nowrap;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const Hint = styled.div`
  color: ${({ theme }) => theme.colors.inkSoft};
  font-size: 0.86rem;

  strong {
    color: ${({ theme }) => theme.colors.trustBlue};
  }
`;

const GhostLink = styled.button`
  appearance: none;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.sunriseOrange};
  font-weight: 600;
  font-size: 0.84rem;
  text-align: left;
  width: fit-content;

  &:hover {
    text-decoration: underline;
  }
`;

const VerifyCard = styled.div`
  background: #fffbeb;
  border: 1px solid #f59e0b;
  padding: 1.25rem 1.4rem;
  border-radius: ${({ theme }) => theme.radius.md};
  box-shadow: ${({ theme }) => theme.shadow.ring};

  strong {
    color: #92400e;
    font-size: 1rem;
    display: block;
    margin-bottom: 0.4rem;
  }

  p {
    margin: 0;
    color: ${({ theme }) => theme.colors.inkSoft};
    font-size: 0.92rem;
    line-height: 1.5;
  }

  a {
    color: ${({ theme }) => theme.colors.trustBlue};
    font-weight: 600;
  }
`;
