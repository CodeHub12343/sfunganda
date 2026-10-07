"use client";

import styled from "styled-components";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/api";
import { useFlag } from "@/lib/flags";
import {
  Banner,
  Card,
  EmptyState,
  ListRow,
  Skeleton,
  StatTile,
  amMedia,
} from "@/components/admin-mobile";

type Props = { userName: string; roles: string[] };

type Project = {
  _id: string;
  name: string;
  slug: string;
  status: string;
  progress_pct: number;
  milestone_counts: { total: number; complete: number };
};

type Accomp = {
  _id: string;
  title: string;
  summary: string;
  state: string;
  version: number;
  submitted_at: string | null;
};

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const Greeting = styled.div`
  padding: 4px 0;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--am-ink);
`;

const Subtitle = styled.p`
  margin: 4px 0 0;
  font-size: 15px;
  color: var(--am-ink-muted);
`;

const Scroller = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 4px 0 8px;

  ${amMedia.md} {
    grid-template-columns: repeat(4, 1fr);
    padding: 0;
  }
`;

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--am-ink);
`;

const SectionLink = styled.a`
  font-size: 13px;
  font-weight: 600;
  color: var(--am-brand-500);
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
  &:focus-visible {
    outline: 2px solid var(--am-brand-500);
    outline-offset: 2px;
    border-radius: var(--am-radius-sm);
  }
`;

const List = styled.div`
  background: var(--am-surface);
  border-radius: var(--am-radius-lg);
  overflow: hidden;
  box-shadow: var(--am-shadow-1);
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;

  ${amMedia.lg} {
    grid-template-columns: 1fr 1fr 1fr;
  }
`;

function Clock({ icon }: { icon: React.ReactNode }) {
  return <span style={{ color: "var(--am-ink-subtle)" }}>{icon}</span>;
}

const dotIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.75" />
    <path
      d="M9 5v4l2.5 1.5"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

function greetingFor(hour: number): string {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function OverviewClient({ userName, roles }: Props) {
  const mobileShell = useFlag("admin.mobileShell");
  if (!mobileShell) {
    return (
      <div>
        <h2
          style={{
            fontFamily: "var(--font-playfair)",
            color: "#103D7A",
            fontSize: "1.6rem",
            marginBottom: "1rem",
          }}
        >
          Overview
        </h2>
        <p style={{ color: "#4b5563", maxWidth: "60ch" }}>
          Welcome to the Sarah&apos;s Foundation admin shell. Choose a section from the
          sidebar to manage users, review the audit log, and more.
        </p>
      </div>
    );
  }
  return <MobileOverview userName={userName} roles={roles} />;
}

function MobileOverview({ userName, roles }: Props) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [pending, setPending] = useState<Accomp[] | null>(null);
  const [recent, setRecent] = useState<Accomp[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const canSeeProjects = roles.some((r) =>
    ["founder", "director", "project_manager"].includes(r)
  );
  const canSeeQueue = roles.some((r) =>
    ["founder", "director", "project_manager"].includes(r)
  );

  const load = useCallback(async () => {
    setErr(null);
    const tasks: Promise<void>[] = [];
    if (canSeeProjects) {
      tasks.push(
        api<{ items: Project[] }>("/projects?limit=100")
          .then((d) => setProjects(d.items))
          .catch((e) => {
            setErr((e as ApiClientError).message);
            setProjects([]);
          })
      );
    } else {
      setProjects([]);
    }
    if (canSeeQueue) {
      tasks.push(
        api<{ items: Accomp[] }>("/accomplishments?state=submitted&limit=10")
          .then((d) => setPending(d.items))
          .catch(() => setPending([]))
      );
      tasks.push(
        api<{ items: Accomp[] }>("/accomplishments?state=published&limit=5")
          .then((d) => setRecent(d.items))
          .catch(() => setRecent([]))
      );
    } else {
      setPending([]);
      setRecent([]);
    }
    await Promise.all(tasks);
  }, [canSeeProjects, canSeeQueue]);

  useEffect(() => {
    void load();
  }, [load]);

  const greeting = useMemo(() => greetingFor(new Date().getHours()), []);

  const activeProjects = projects?.filter((p) => p.status === "active") ?? [];
  const headline = pending && pending.length > 0
    ? `${pending.length} item${pending.length === 1 ? "" : "s"} need${pending.length === 1 ? "s" : ""} your review`
    : "You're all caught up";

  const stats = [
    canSeeQueue && {
      label: "Pending reviews",
      value: pending ? pending.length : "—",
      icon: <Clock icon={dotIcon} />,
    },
    canSeeProjects && {
      label: "Active projects",
      value: projects ? activeProjects.length : "—",
    },
    canSeeProjects && {
      label: "Total projects",
      value: projects ? projects.length : "—",
    },
    canSeeQueue && {
      label: "Published (5 latest)",
      value: recent ? recent.length : "—",
    },
  ].filter(Boolean) as {
    label: string;
    value: string | number;
    icon?: React.ReactNode;
  }[];

  return (
    <Page>
      <Greeting>
        <Title>
          {greeting}, {userName.split(" ")[0]}
        </Title>
        <Subtitle>{headline}</Subtitle>
      </Greeting>

      {err && (
        <Banner tone="warning" title="Couldn't load some stats">
          {err}
        </Banner>
      )}

      <Scroller>
        {stats.length === 0 ? (
          <>
            <Skeleton height={112} width={160} radius="var(--am-radius-lg)" />
            <Skeleton height={112} width={160} radius="var(--am-radius-lg)" />
          </>
        ) : (
          stats.map((s) => (
            <StatTile key={s.label} label={s.label} value={s.value} icon={s.icon} />
          ))
        )}
      </Scroller>

      <Grid>
        {canSeeQueue && (
          <Section>
            <SectionHeader>
              <SectionTitle>Needs you</SectionTitle>
              <SectionLink href="/admin/queue">View all</SectionLink>
            </SectionHeader>
            {pending === null ? (
              <Card>
                <Skeleton width="60%" height={16} />
                <div style={{ height: 8 }} />
                <Skeleton width="40%" height={12} />
              </Card>
            ) : pending.length === 0 ? (
              <Card padding="none">
                <EmptyState title="Nothing pending" description="Your review queue is empty." />
              </Card>
            ) : (
              <List>
                {pending.slice(0, 3).map((a) => (
                  <ListRow
                    key={a._id}
                    title={a.title}
                    meta={a.summary || "No summary"}
                    onClick={() => router.push(`/admin/queue/${a._id}`)}
                  />
                ))}
              </List>
            )}
          </Section>
        )}

        {canSeeQueue && (
          <Section>
            <SectionHeader>
              <SectionTitle>Recent activity</SectionTitle>
            </SectionHeader>
            {recent === null ? (
              <Card>
                <Skeleton width="70%" height={16} />
                <div style={{ height: 6 }} />
                <Skeleton width="40%" height={12} />
              </Card>
            ) : recent.length === 0 ? (
              <Card padding="none">
                <EmptyState title="No activity yet" />
              </Card>
            ) : (
              <List>
                {recent.map((a) => (
                  <ListRow
                    key={a._id}
                    title={a.title}
                    meta={
                      a.submitted_at
                        ? `Published · ${new Date(a.submitted_at).toLocaleDateString()}`
                        : "Published"
                    }
                    onClick={() => router.push(`/admin/queue/${a._id}`)}
                  />
                ))}
              </List>
            )}
          </Section>
        )}

        {canSeeProjects && (
          <Section>
            <SectionHeader>
              <SectionTitle>Active projects</SectionTitle>
              <SectionLink href="/admin/projects">View all</SectionLink>
            </SectionHeader>
            {projects === null ? (
              <Card>
                <Skeleton width="60%" height={16} />
              </Card>
            ) : activeProjects.length === 0 ? (
              <Card padding="none">
                <EmptyState
                  title="No active projects"
                  description="Projects you activate will appear here."
                />
              </Card>
            ) : (
              <List>
                {activeProjects.slice(0, 3).map((p) => (
                  <ListRow
                    key={p._id}
                    title={p.name}
                    meta={`${p.milestone_counts.complete}/${p.milestone_counts.total} milestones · ${p.progress_pct}%`}
                    onClick={() => router.push(`/admin/projects/${p._id}`)}
                  />
                ))}
              </List>
            )}
          </Section>
        )}
      </Grid>
    </Page>
  );
}
