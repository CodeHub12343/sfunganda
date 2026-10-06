"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styled from "styled-components";
import { api, ApiClientError } from "@/lib/api";
import { LoadingState, ErrorState } from "@/components/ui/States";

export const dynamic = "force-dynamic";

type Dashboard = {
  profile: { display_name: string; anonymous_on_wall: boolean } | null;
  follows: Array<{ _id: string; project: { _id: string; slug: string; name: string } }>;
  donations: { count: number; lifetime_cents: number; currency: string };
  unread_notifications: number;
};

function money(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default function DashboardOverview() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setData(await api<Dashboard>("/me/dashboard"));
      } catch (e) {
        setErr((e as ApiClientError).message);
      }
    })();
  }, []);

  if (err) return <ErrorState message={err} />;
  if (!data) return <LoadingState />;

  const name = data.profile?.display_name ?? "friend";
  const firstName = name.split(" ")[0];

  return (
    <Page>
      <Hero>
        <Eyebrow>Your dashboard</Eyebrow>
        <HeroTitle>
          Welcome back, <span>{firstName}</span>.
        </HeroTitle>
        <HeroLede>
          Thank you for standing with Sarah&apos;s Foundation Uganda. Here&apos;s a snapshot of
          your giving, the projects you&apos;re following, and the latest from the field.
        </HeroLede>
        <HeroActions>
          <PrimaryBtn href="/projects">Discover projects</PrimaryBtn>
          <GhostBtn href="/donate">Make a donation</GhostBtn>
        </HeroActions>
      </Hero>

      <Grid>
        <Tile href="/dashboard/follows" accent="blue">
          <TileIcon aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </TileIcon>
          <TileLabel>Projects you follow</TileLabel>
          <TileValue>{data.follows.length}</TileValue>
          <TileHint>View following →</TileHint>
        </Tile>

        <Tile href="/dashboard/donations" accent="gold">
          <TileIcon aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1v22" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </TileIcon>
          <TileLabel>Donations made</TileLabel>
          <TileValue>{data.donations.count}</TileValue>
          <TileHint>See receipts →</TileHint>
        </Tile>

        <Tile href="/dashboard/donations" accent="green">
          <TileIcon aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 7.78L12 13.46l-1.06-1.07a5.5 5.5 0 1 0-7.78-7.78" />
              <path d="M3 21l6-6" />
              <path d="M14 14l7 7" />
            </svg>
          </TileIcon>
          <TileLabel>Lifetime giving</TileLabel>
          <TileValue>{money(data.donations.lifetime_cents, data.donations.currency)}</TileValue>
          <TileHint>Your total impact →</TileHint>
        </Tile>

        <Tile href="/dashboard/notifications" accent="orange">
          <TileIcon aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {data.unread_notifications > 0 ? <Dot>{data.unread_notifications}</Dot> : null}
          </TileIcon>
          <TileLabel>Unread updates</TileLabel>
          <TileValue>{data.unread_notifications}</TileValue>
          <TileHint>Open notifications →</TileHint>
        </Tile>
      </Grid>

      <Section>
        <SectionHead>
          <h2>Projects you follow</h2>
          <SectionLink href="/projects">Browse all projects →</SectionLink>
        </SectionHead>

        {data.follows.length === 0 ? (
          <EmptyCard>
            <h3>No projects yet</h3>
            <p>
              Follow a project to receive updates from the field, see how donations are
              deployed, and track its impact over time.
            </p>
            <PrimaryBtn href="/projects">Explore projects</PrimaryBtn>
          </EmptyCard>
        ) : (
          <FollowGrid>
            {data.follows.map((f) => (
              <FollowCard key={f._id} href={`/projects/${f.project.slug}`}>
                <FollowName>{f.project.name}</FollowName>
                <FollowMeta>You&apos;re following this project</FollowMeta>
                <FollowArrow aria-hidden="true">→</FollowArrow>
              </FollowCard>
            ))}
          </FollowGrid>
        )}
      </Section>

      <Section>
        <SectionHead>
          <h2>Quick actions</h2>
        </SectionHead>
        <ActionsGrid>
          <ActionCard href="/dashboard/preferences">
            <ActionTitle>Communication preferences</ActionTitle>
            <ActionBody>
              Choose how often you hear from us and which updates matter to you.
            </ActionBody>
          </ActionCard>
          <ActionCard href="/dashboard/account">
            <ActionTitle>Account & security</ActionTitle>
            <ActionBody>
              Update your profile, email, password, and multi-factor authentication.
            </ActionBody>
          </ActionCard>
          <ActionCard href="/transparency">
            <ActionTitle>Transparency reports</ActionTitle>
            <ActionBody>
              Read audited financials and see exactly where every shilling goes.
            </ActionBody>
          </ActionCard>
          <ActionCard href="/accomplishments">
            <ActionTitle>Impact & accomplishments</ActionTitle>
            <ActionBody>
              Milestones unlocked across education, health, and community programs.
            </ActionBody>
          </ActionCard>
        </ActionsGrid>
      </Section>
    </Page>
  );
}

/* ===================== styles ===================== */

const Page = styled.section`
  display: grid;
  gap: 1.75rem;
`;

const Hero = styled.div`
  position: relative;
  overflow: hidden;
  border-radius: ${({ theme }) => theme.radius.card};
  padding: 2rem 1.5rem;
  color: ${({ theme }) => theme.colors.onDark};
  background: ${({ theme }) => theme.gradients.trust};
  box-shadow: ${({ theme }) => theme.shadow.soft};

  &::before {
    content: "";
    position: absolute;
    inset: auto -40px -80px auto;
    width: 240px;
    height: 240px;
    border-radius: 999px;
    background: ${({ theme }) => theme.gradients.sunrise};
    opacity: 0.22;
    filter: blur(10px);
    pointer-events: none;
  }

  @media (min-width: 768px) {
    padding: 2.5rem 2.25rem;
  }
`;

const Eyebrow = styled.div`
  font-size: 0.78rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.hopeGold};
  font-weight: 600;
`;

const HeroTitle = styled.h1`
  font-family: ${({ theme }) => theme.font.heading};
  font-size: clamp(1.75rem, 3vw + 1rem, 2.6rem);
  line-height: 1.1;
  margin: 0.5rem 0 0.75rem;
  font-weight: 700;

  span {
    color: ${({ theme }) => theme.colors.hopeGold};
  }
`;

const HeroLede = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.onDarkSoft};
  font-size: 1rem;
  line-height: 1.6;
  max-width: 56ch;
`;

const HeroActions = styled.div`
  margin-top: 1.25rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
`;

const PrimaryBtn = styled(Link)`
  display: inline-flex;
  align-items: center;
  padding: 0.65rem 1.1rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.gradients.sunrise};
  color: #1a0f00;
  font-weight: 600;
  font-size: 0.92rem;
  text-decoration: none;
  box-shadow: ${({ theme }) => theme.shadow.glow};
  transition: transform 160ms ${({ theme }) => theme.ease.out};

  &:hover,
  &:focus-visible {
    transform: translateY(-1px);
  }
`;

const GhostBtn = styled(Link)`
  display: inline-flex;
  align-items: center;
  padding: 0.65rem 1.1rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: rgba(255, 255, 255, 0.08);
  color: ${({ theme }) => theme.colors.onDark};
  font-weight: 600;
  font-size: 0.92rem;
  text-decoration: none;
  border: 1px solid rgba(255, 255, 255, 0.22);

  &:hover,
  &:focus-visible {
    background: rgba(255, 255, 255, 0.14);
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;

  @media (min-width: 768px) {
    gap: 1.1rem;
  }
`;

type Accent = "blue" | "gold" | "green" | "orange";
const accentColor: Record<Accent, string> = {
  blue: "#103D7A",
  gold: "#F7B733",
  green: "#3D8B37",
  orange: "#F28C28",
};

const Tile = styled(Link)<{ accent: Accent }>`
  position: relative;
  display: block;
  padding: 1rem 1rem 1.1rem;
  border-radius: ${({ theme }) => theme.radius.md};
  background: #ffffff;
  text-decoration: none;
  color: ${({ theme }) => theme.colors.ink};
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.shadow.ring};
  overflow: hidden;
  transition: transform 180ms ${({ theme }) => theme.ease.out}, box-shadow 180ms;

  &::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    background: ${({ accent }) => accentColor[accent]};
  }

  &:hover,
  &:focus-visible {
    transform: translateY(-2px);
    box-shadow: ${({ theme }) => theme.shadow.lift};
  }

  @media (min-width: 768px) {
    padding: 1.25rem 1.35rem 1.4rem;
  }
`;

const TileIcon = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: rgba(16, 61, 122, 0.06);
  color: ${({ theme }) => theme.colors.trustBlue};
  margin-bottom: 0.65rem;
`;

const Dot = styled.span`
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.sunriseOrange};
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 2px #fff;
`;

const TileLabel = styled.div`
  color: ${({ theme }) => theme.colors.inkMuted};
  font-size: 0.78rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
`;

const TileValue = styled.div`
  font-family: ${({ theme }) => theme.font.heading};
  font-size: clamp(1.4rem, 2vw + 0.6rem, 1.9rem);
  font-weight: 700;
  color: ${({ theme }) => theme.colors.trustBlue};
  margin-top: 0.25rem;
  line-height: 1.1;
  word-break: break-word;
`;

const TileHint = styled.div`
  margin-top: 0.65rem;
  color: ${({ theme }) => theme.colors.sunriseOrange};
  font-size: 0.8rem;
  font-weight: 600;
`;

const Section = styled.section`
  display: grid;
  gap: 0.9rem;
`;

const SectionHead = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;

  h2 {
    font-family: ${({ theme }) => theme.font.heading};
    font-size: 1.25rem;
    color: ${({ theme }) => theme.colors.trustBlue};
    margin: 0;
  }
`;

const SectionLink = styled(Link)`
  color: ${({ theme }) => theme.colors.sunriseOrange};
  font-weight: 600;
  font-size: 0.88rem;
  text-decoration: none;

  &:hover,
  &:focus-visible {
    text-decoration: underline;
  }
`;

const FollowGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const FollowCard = styled(Link)`
  position: relative;
  display: block;
  padding: 1rem 1.1rem;
  border-radius: ${({ theme }) => theme.radius.md};
  background: #fff;
  border: 1px solid ${({ theme }) => theme.colors.border};
  text-decoration: none;
  color: ${({ theme }) => theme.colors.ink};
  box-shadow: ${({ theme }) => theme.shadow.ring};
  transition: transform 180ms ${({ theme }) => theme.ease.out}, box-shadow 180ms;

  &:hover,
  &:focus-visible {
    transform: translateY(-2px);
    box-shadow: ${({ theme }) => theme.shadow.lift};
  }
`;

const FollowName = styled.div`
  font-weight: 600;
  color: ${({ theme }) => theme.colors.trustBlue};
  font-size: 1rem;
  line-height: 1.3;
`;

const FollowMeta = styled.div`
  margin-top: 0.3rem;
  color: ${({ theme }) => theme.colors.inkMuted};
  font-size: 0.82rem;
`;

const FollowArrow = styled.span`
  position: absolute;
  top: 1rem;
  right: 1rem;
  color: ${({ theme }) => theme.colors.hopeGold};
  font-size: 1.1rem;
  font-weight: 700;
`;

const EmptyCard = styled.div`
  display: grid;
  justify-items: start;
  gap: 0.65rem;
  padding: 1.75rem;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.bgPremium};
  border: 1px dashed ${({ theme }) => theme.colors.borderStrong};

  h3 {
    margin: 0;
    font-family: ${({ theme }) => theme.font.heading};
    color: ${({ theme }) => theme.colors.trustBlue};
    font-size: 1.1rem;
  }

  p {
    margin: 0;
    color: ${({ theme }) => theme.colors.inkSoft};
    font-size: 0.95rem;
    line-height: 1.5;
    max-width: 60ch;
  }
`;

const ActionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const ActionCard = styled(Link)`
  display: block;
  padding: 1.1rem 1.15rem;
  border-radius: ${({ theme }) => theme.radius.md};
  background: #fff;
  border: 1px solid ${({ theme }) => theme.colors.border};
  text-decoration: none;
  color: ${({ theme }) => theme.colors.ink};
  box-shadow: ${({ theme }) => theme.shadow.ring};
  transition: transform 180ms ${({ theme }) => theme.ease.out}, box-shadow 180ms, border-color 180ms;

  &:hover,
  &:focus-visible {
    transform: translateY(-2px);
    box-shadow: ${({ theme }) => theme.shadow.lift};
    border-color: ${({ theme }) => theme.colors.borderStrong};
  }
`;

const ActionTitle = styled.div`
  font-weight: 700;
  color: ${({ theme }) => theme.colors.trustBlue};
  font-size: 0.98rem;
  margin-bottom: 0.3rem;
`;

const ActionBody = styled.div`
  color: ${({ theme }) => theme.colors.inkSoft};
  font-size: 0.88rem;
  line-height: 1.5;
`;
