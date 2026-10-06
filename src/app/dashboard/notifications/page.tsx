"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { api, ApiClientError } from "@/lib/api";
import { ErrorState, LoadingState } from "@/components/ui/States";

export const dynamic = "force-dynamic";

type Row = {
  _id: string;
  topic: string;
  title: string;
  body: string;
  url: string | null;
  read_at: string | null;
  created_at: string;
};

function relativeTime(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const data = await api<{ items: Row[]; next_cursor: string | null }>(
        `/me/notifications?${unreadOnly ? "unread=1&" : ""}limit=50`
      );
      setRows(data.items);
    } catch (e) {
      setErr((e as ApiClientError).message);
    }
  }, [unreadOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markAllRead() {
    setMarking(true);
    try {
      await api("/me/notifications/mark-read", { json: { all: true } });
      void load();
    } finally {
      setMarking(false);
    }
  }

  const unreadCount = useMemo(
    () => (rows ? rows.filter((r) => !r.read_at).length : 0),
    [rows],
  );

  return (
    <Page>
      <Header>
        <HeaderText>
          <Eyebrow>Inbox</Eyebrow>
          <Title>Your notifications</Title>
          <Lede>
            Updates from projects you follow, milestone announcements, and donation
            receipts — all in one place.
          </Lede>
        </HeaderText>
        <HeaderActions>
          <SummaryPill>
            <Dot /> {unreadCount} unread
          </SummaryPill>
          <MarkBtn type="button" onClick={markAllRead} disabled={marking || unreadCount === 0}>
            {marking ? "Marking…" : "Mark all read"}
          </MarkBtn>
        </HeaderActions>
      </Header>

      <FilterRow>
        <FilterTab $active={!unreadOnly} onClick={() => setUnreadOnly(false)} type="button">
          All
        </FilterTab>
        <FilterTab $active={unreadOnly} onClick={() => setUnreadOnly(true)} type="button">
          Unread only
        </FilterTab>
      </FilterRow>

      {err ? <ErrorState message={err} onRetry={() => void load()} /> : null}
      {rows === null && !err ? <LoadingState /> : null}

      {rows && rows.length === 0 ? (
        <EmptyCard>
          <EmptyBadge aria-hidden="true">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </EmptyBadge>
          <h3>You&apos;re all caught up</h3>
          <p>Nothing new right now. We&apos;ll let you know as soon as there is.</p>
        </EmptyCard>
      ) : null}

      {rows && rows.length > 0 ? (
        <Grid>
          {rows.map((n) => {
            const unread = !n.read_at;
            const inner = (
              <>
                <ItemHead>
                  <TitleRow>
                    {unread ? <UnreadMark aria-hidden="true" /> : null}
                    <strong>{n.title}</strong>
                  </TitleRow>
                  <Time>{relativeTime(n.created_at)}</Time>
                </ItemHead>
                {n.body ? <Body>{n.body}</Body> : null}
                {n.topic ? <Topic>{n.topic.replace(/_/g, " ")}</Topic> : null}
              </>
            );
            return n.url ? (
              <ItemLink key={n._id} href={n.url} $unread={unread}>
                {inner}
              </ItemLink>
            ) : (
              <Item key={n._id} $unread={unread}>
                {inner}
              </Item>
            );
          })}
        </Grid>
      ) : null}
    </Page>
  );
}

/* ===================== styles ===================== */

const Page = styled.section`
  display: grid;
  gap: 1.25rem;
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

const HeaderActions = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
`;

const SummaryPill = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.4rem 0.75rem;
  border-radius: 999px;
  background: rgba(242, 140, 40, 0.1);
  color: ${({ theme }) => theme.colors.sunriseOrange};
  font-size: 0.82rem;
  font-weight: 600;
`;

const Dot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.sunriseOrange};
`;

const MarkBtn = styled.button`
  appearance: none;
  cursor: pointer;
  padding: 0.5rem 0.95rem;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.trustBlue};
  background: #fff;
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.shadow.ring};

  &:hover:not(:disabled),
  &:focus-visible:not(:disabled) {
    border-color: ${({ theme }) => theme.colors.trustBlue};
    background: ${({ theme }) => theme.colors.bgSoft};
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const FilterRow = styled.div`
  display: inline-flex;
  padding: 4px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.bgSoft};
  border: 1px solid ${({ theme }) => theme.colors.border};
  width: fit-content;
`;

const FilterTab = styled.button<{ $active: boolean }>`
  appearance: none;
  border: none;
  cursor: pointer;
  padding: 0.45rem 1rem;
  border-radius: 999px;
  font-size: 0.84rem;
  font-weight: 600;

  background: ${({ $active, theme }) =>
    $active ? theme.colors.trustBlue : "transparent"};
  color: ${({ $active, theme }) => ($active ? "#fff" : theme.colors.inkSoft)};
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const itemBase = `
  display: grid;
  gap: 0.5rem;
  padding: 1rem 1.1rem;
  border-radius: 20px;
  background: #fff;
  border: 1px solid rgba(16, 61, 122, 0.1);
  box-shadow: 0 0 0 1px rgba(16, 61, 122, 0.06);
  text-decoration: none;
  color: inherit;
  position: relative;
  transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
`;

const Item = styled.div<{ $unread: boolean }>`
  ${itemBase}
  background: ${({ $unread }) => ($unread ? "#fff" : "#fafbfc")};
  border-left: 4px solid
    ${({ $unread }) => ($unread ? "#F28C28" : "rgba(16, 61, 122, 0.12)")};
`;

const ItemLink = styled(Link)<{ $unread: boolean }>`
  ${itemBase}
  background: ${({ $unread }) => ($unread ? "#fff" : "#fafbfc")};
  border-left: 4px solid
    ${({ $unread }) => ($unread ? "#F28C28" : "rgba(16, 61, 122, 0.12)")};

  &:hover,
  &:focus-visible {
    transform: translateY(-2px);
    box-shadow: 0 18px 50px rgba(8, 23, 53, 0.14);
    border-color: rgba(16, 61, 122, 0.2);
  }
`;

const ItemHead = styled.div`
  display: flex;
  gap: 0.75rem;
  justify-content: space-between;
  align-items: flex-start;
`;

const TitleRow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;

  strong {
    color: ${({ theme }) => theme.colors.trustBlue};
    font-size: 0.98rem;
    line-height: 1.3;
  }
`;

const UnreadMark = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.sunriseOrange};
  flex: 0 0 auto;
  box-shadow: 0 0 0 3px rgba(242, 140, 40, 0.18);
`;

const Time = styled.small`
  color: ${({ theme }) => theme.colors.inkMuted};
  font-size: 0.76rem;
  white-space: nowrap;
`;

const Body = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.inkSoft};
  font-size: 0.9rem;
  line-height: 1.5;
`;

const Topic = styled.div`
  margin-top: 0.1rem;
  display: inline-block;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  background: rgba(16, 61, 122, 0.06);
  color: ${({ theme }) => theme.colors.trustBlue};
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: capitalize;
  width: fit-content;
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
    margin: 0;
    color: ${({ theme }) => theme.colors.inkSoft};
    font-size: 0.95rem;
    max-width: 44ch;
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
