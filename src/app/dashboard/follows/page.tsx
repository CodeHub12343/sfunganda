"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styled from "styled-components";
import { api, ApiClientError } from "@/lib/api";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";

export const dynamic = "force-dynamic";

type Row = { _id: string; project: { _id: string; slug: string; name: string } };

export default function FollowsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      setRows(await api<Row[]>("/me/follows"));
    } catch (e) {
      setErr((e as ApiClientError).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function unfollow(projectId: string) {
    setBusyId(projectId);
    try {
      await api(`/me/follows/${projectId}`, { method: "DELETE" });
      toast.push({ tone: "success", message: "Unfollowed" });
      void load();
    } catch (e) {
      toast.push({ tone: "danger", message: (e as ApiClientError).message });
    } finally {
      setBusyId(null);
    }
  }

  if (err) return <ErrorState message={err} onRetry={load} />;
  if (rows === null) return <LoadingState />;

  return (
    <Page>
      <Header>
        <HeaderText>
          <Eyebrow>Following</Eyebrow>
          <Title>Projects you follow</Title>
          <Lede>
            Projects on this list send you updates when they publish milestones, new
            accomplishments, or stories from the field.
          </Lede>
        </HeaderText>
        <HeaderCta href="/projects">Browse all projects</HeaderCta>
      </Header>

      {rows.length === 0 ? (
        <EmptyCard>
          <EmptyBadge aria-hidden="true">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </EmptyBadge>
          <h3>You aren&apos;t following anything yet</h3>
          <p>
            Follow a project to receive updates when it publishes milestones, new
            accomplishments, or stories from the field.
          </p>
          <Link href="/projects">
            <PrimaryBtn>Explore projects</PrimaryBtn>
          </Link>
        </EmptyCard>
      ) : (
        <Grid>
          {rows.map((r) => {
            const initial = r.project.name.charAt(0).toUpperCase();
            const busy = busyId === r.project._id;
            return (
              <Card key={r._id}>
                <CardHead>
                  <Avatar aria-hidden="true">{initial}</Avatar>
                  <Meta>
                    <Name href={`/projects/${r.project.slug}`}>{r.project.name}</Name>
                    <Sub>Receiving updates</Sub>
                  </Meta>
                </CardHead>
                <CardBody>
                  <StatRow>
                    <Stat>
                      <StatDot $color="#F28C28" />
                      Active
                    </Stat>
                    <SlugText>/{r.project.slug}</SlugText>
                  </StatRow>
                </CardBody>
                <CardActions>
                  <ViewBtn href={`/projects/${r.project.slug}`}>View project</ViewBtn>
                  <UnfollowBtn
                    type="button"
                    onClick={() => unfollow(r.project._id)}
                    disabled={busy}
                  >
                    {busy ? "Unfollowing…" : "Unfollow"}
                  </UnfollowBtn>
                </CardActions>
              </Card>
            );
          })}
        </Grid>
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
  max-width: 60ch;
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

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;

  @media (min-width: 540px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }
`;

const Card = styled.div`
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 0.9rem;
  padding: 1.1rem 1.2rem 1rem;
  border-radius: ${({ theme }) => theme.radius.md};
  background: #fff;
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.shadow.ring};
  transition: transform 180ms ease, box-shadow 180ms ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: ${({ theme }) => theme.shadow.lift};
  }
`;

const CardHead = styled.div`
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 0.75rem;
  align-items: center;
`;

const Avatar = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: ${({ theme }) => theme.gradients.trust};
  color: #fff;
  font-family: ${({ theme }) => theme.font.heading};
  font-size: 1.1rem;
  font-weight: 700;
  box-shadow: 0 6px 18px rgba(16, 61, 122, 0.25);
`;

const Meta = styled.div`
  min-width: 0;
`;

const Name = styled(Link)`
  display: block;
  color: ${({ theme }) => theme.colors.trustBlue};
  font-family: ${({ theme }) => theme.font.heading};
  font-weight: 700;
  font-size: 1rem;
  line-height: 1.25;
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    text-decoration: underline;
  }
`;

const Sub = styled.div`
  color: ${({ theme }) => theme.colors.inkMuted};
  font-size: 0.78rem;
  margin-top: 0.1rem;
`;

const CardBody = styled.div`
  min-width: 0;
`;

const StatRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const Stat = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.inkSoft};
  font-weight: 500;
`;

const StatDot = styled.span<{ $color: string }>`
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: ${({ $color }) => $color};
`;

const SlugText = styled.span`
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.76rem;
  color: ${({ theme }) => theme.colors.inkMuted};
  background: ${({ theme }) => theme.colors.bgSoft};
  padding: 0.1rem 0.45rem;
  border-radius: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
`;

const CardActions = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
  padding-top: 0.6rem;
  border-top: 1px dashed ${({ theme }) => theme.colors.border};
`;

const ViewBtn = styled(Link)`
  display: inline-flex;
  justify-content: center;
  align-items: center;
  padding: 0.5rem 0.8rem;
  border-radius: 999px;
  background: rgba(16, 61, 122, 0.07);
  color: ${({ theme }) => theme.colors.trustBlue};
  font-weight: 600;
  font-size: 0.84rem;
  text-decoration: none;
  border: 1px solid transparent;

  &:hover,
  &:focus-visible {
    background: rgba(16, 61, 122, 0.11);
    border-color: ${({ theme }) => theme.colors.trustBlue};
  }
`;

const UnfollowBtn = styled.button`
  appearance: none;
  cursor: pointer;
  padding: 0.5rem 0.9rem;
  border-radius: 999px;
  background: #fff;
  color: #991b1b;
  font-weight: 600;
  font-size: 0.84rem;
  border: 1px solid #fecaca;

  &:hover:not(:disabled),
  &:focus-visible:not(:disabled) {
    background: #fef2f2;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const EmptyCard = styled.div`
  display: grid;
  justify-items: center;
  text-align: center;
  gap: 0.5rem;
  padding: 2.5rem 1.5rem;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.bgPremium};
  border: 1px dashed ${({ theme }) => theme.colors.borderStrong};

  h3 {
    margin: 0.4rem 0 0;
    font-family: ${({ theme }) => theme.font.heading};
    color: ${({ theme }) => theme.colors.trustBlue};
    font-size: 1.15rem;
  }

  p {
    margin: 0 0 0.6rem;
    color: ${({ theme }) => theme.colors.inkSoft};
    font-size: 0.95rem;
    max-width: 50ch;
  }
`;

const EmptyBadge = styled.div`
  display: inline-grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 999px;
  background: ${({ theme }) => theme.gradients.sunrise};
  color: #fff;
  box-shadow: ${({ theme }) => theme.shadow.glow};
`;

const PrimaryBtn = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.65rem 1.2rem;
  border-radius: 999px;
  background: ${({ theme }) => theme.gradients.sunrise};
  color: #1a0f00;
  font-weight: 700;
  font-size: 0.9rem;
  box-shadow: ${({ theme }) => theme.shadow.glow};
`;
