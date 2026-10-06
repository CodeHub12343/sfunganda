"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import styled from "styled-components";
import { api, ApiClientError } from "@/lib/api";
import { Button as LegacyButton } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useFlag } from "@/lib/flags";
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  FilterChip,
  ListRow,
  Modal,
  SegmentedControl,
  Sheet,
  Skeleton,
  StatTile,
  TrendLine,
  amMedia,
  useAdminToast,
} from "@/components/admin-mobile";

export const dynamic = "force-dynamic";

type Platform = "youtube" | "facebook" | "instagram" | "tiktok" | "x" | "linkedin";

type Status = {
  enabled: boolean;
  platforms: Array<{ platform: Platform; configured: boolean }>;
};

type Connection = {
  id: string;
  platform: Platform;
  channel_name: string;
  status: "active" | "revoked" | "error";
  connected_at: string;
  last_error: string | null;
};

type Post = {
  id: string;
  accomplishment_id: string;
  media_asset_id: string;
  platform: Platform;
  state: "queued" | "posting" | "posted" | "failed" | "skipped";
  external_id: string | null;
  external_url: string | null;
  attempts: number;
  last_error: string | null;
  skip_reason: string | null;
  created_at: string;
  scheduled_for?: string | null;
  caption?: string | null;
};

export default function AdminSocial() {
  const mobile = useFlag("admin.mobileShell");
  return mobile ? <MobileSocial /> : <LegacySocial />;
}

/* ================================================================= */
/* Mobile                                                             */
/* ================================================================= */

const CHANNELS = [
  { value: "facebook" as const, label: "Facebook", limit: 63206 },
  { value: "instagram" as const, label: "Instagram", limit: 2200 },
  { value: "x" as const, label: "X", limit: 280 },
  { value: "linkedin" as const, label: "LinkedIn", limit: 3000 },
];

const TABS = [
  { value: "compose" as const, label: "Compose" },
  { value: "scheduled" as const, label: "Scheduled" },
  { value: "published" as const, label: "Published" },
  { value: "analytics" as const, label: "Analytics" },
];
type Tab = (typeof TABS)[number]["value"];

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const PageTitle = styled.h1`
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--am-ink);
`;

const ComposeArea = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Editor = styled.textarea`
  min-height: 160px;
  width: 100%;
  padding: 12px;
  background: var(--am-surface);
  color: var(--am-ink);
  border: 1px solid var(--am-border-strong);
  border-radius: var(--am-radius-md);
  resize: vertical;
  font: inherit;
  &:focus {
    outline: 2px solid var(--am-brand-500);
    outline-offset: 2px;
    border-color: var(--am-brand-500);
  }
`;

const CharCount = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 8px;
  font-size: 12px;
`;

const CountChip = styled.div<{ $over: boolean }>`
  display: flex;
  justify-content: space-between;
  padding: 6px 10px;
  border-radius: var(--am-radius-sm);
  background: ${({ $over }) =>
    $over ? "var(--am-danger-50)" : "var(--am-bg-soft)"};
  color: ${({ $over }) => ($over ? "var(--am-danger-700, #991b1b)" : "var(--am-ink-muted)")};
  font-variant-numeric: tabular-nums;
`;

const ChannelChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const BottomBar = styled.div`
  position: sticky;
  bottom: 0;
  background: var(--am-surface);
  border-top: 1px solid var(--am-border);
  padding: 10px 0;
  display: flex;
  gap: 8px;
  z-index: 2;
`;

const StatRow = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  ${amMedia.md} {
    grid-template-columns: repeat(4, 1fr);
  }
`;

const ListWrap = styled(Card)`
  padding: 0;
  overflow: hidden;
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--am-ink-muted);
`;

const Input = styled.input`
  min-height: 44px;
  padding: 0 12px;
  border-radius: var(--am-radius-md);
  background: var(--am-surface);
  color: var(--am-ink);
  border: 1px solid var(--am-border-strong);
  font: inherit;
`;

function stateTone(s: Post["state"]): "success" | "info" | "warning" | "danger" | "neutral" {
  if (s === "posted") return "success";
  if (s === "posting") return "info";
  if (s === "queued") return "warning";
  if (s === "failed") return "danger";
  return "neutral";
}

function PlatformIcon({ platform }: { platform: Platform }) {
  const map: Record<Platform, string> = {
    facebook: "f",
    instagram: "ig",
    x: "x",
    linkedin: "in",
    youtube: "yt",
    tiktok: "tt",
  };
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        width: 28,
        height: 28,
        borderRadius: 999,
        background: "var(--am-brand-50)",
        color: "var(--am-brand-600)",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {map[platform]}
    </span>
  );
}

function MobileSocial() {
  const toast = useAdminToast();
  const search = useSearchParams();
  const [tab, setTab] = useState<Tab>("compose");
  const [status, setStatus] = useState<Status | null>(null);
  const [conns, setConns] = useState<Connection[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [compose, setCompose] = useState("");
  const [channels, setChannels] = useState<Platform[]>([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [confirmRevoke, setConfirmRevoke] = useState<Connection | null>(null);
  const [filterPlatform, setFilterPlatform] = useState<Platform | "all">("all");

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [s, c, p] = await Promise.all([
        api<Status>("/social/platforms"),
        api<Connection[]>("/social/connections"),
        api<Post[]>("/social/posts?limit=100"),
      ]);
      setStatus(s);
      setConns(c);
      setPosts(p);
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Could not load.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const name = search.get("connected");
    if (name) toast.push({ tone: "success", message: `${name} connected.` });
  }, [search, toast]);

  async function connect(platform: Platform) {
    try {
      const r = await api<{ url: string }>(`/social/connections/${platform}/begin`, {
        json: {},
      });
      window.location.href = r.url;
    } catch (e) {
      toast.push({
        tone: "danger",
        message: e instanceof ApiClientError ? e.message : "Connect failed.",
      });
    }
  }

  async function revoke(c: Connection) {
    try {
      await api(`/social/connections/${c.id}/revoke`, { json: {} });
      toast.push({ tone: "success", message: "Revoked." });
      setConfirmRevoke(null);
      await load();
    } catch (e) {
      toast.push({
        tone: "danger",
        message: e instanceof ApiClientError ? e.message : "Failed.",
      });
    }
  }

  async function retry(id: string) {
    try {
      await api(`/social/posts/${id}/retry`, { json: {} });
      toast.push({ tone: "success", message: "Retry queued." });
      await load();
    } catch (e) {
      toast.push({
        tone: "danger",
        message: e instanceof ApiClientError ? e.message : "Retry failed.",
      });
    }
  }

  const scheduled = useMemo(
    () =>
      posts.filter(
        (p) =>
          p.state === "queued" ||
          p.state === "posting" ||
          (!!p.scheduled_for && Date.parse(p.scheduled_for) > Date.now())
      ),
    [posts]
  );

  const published = useMemo(() => posts.filter((p) => p.state === "posted"), [posts]);

  const filteredList = useCallback(
    (base: Post[]) =>
      filterPlatform === "all" ? base : base.filter((p) => p.platform === filterPlatform),
    [filterPlatform]
  );

  const perChannel = useMemo(() => {
    const m: Record<string, { posted: number; failed: number; queued: number }> = {};
    for (const p of posts) {
      m[p.platform] ??= { posted: 0, failed: 0, queued: 0 };
      if (p.state === "posted") m[p.platform].posted++;
      else if (p.state === "failed") m[p.platform].failed++;
      else m[p.platform].queued++;
    }
    return m;
  }, [posts]);

  // Mini trend: last 14 days post counts per day.
  const trend = useMemo(() => {
    const days = 14;
    const buckets: number[] = Array.from({ length: days }, () => 0);
    const now = Date.now();
    for (const p of posts) {
      const t = Date.parse(p.created_at);
      if (!Number.isFinite(t)) continue;
      const idx = Math.floor((now - t) / 86_400_000);
      if (idx >= 0 && idx < days) buckets[days - 1 - idx] += 1;
    }
    return buckets;
  }, [posts]);

  function schedule() {
    if (!scheduleAt) return;
    toast.push({
      tone: "info",
      message: `Scheduled for ${new Date(scheduleAt).toLocaleString()} — attach to an accomplishment to publish.`,
    });
    setScheduleOpen(false);
  }

  function postNow() {
    if (!compose.trim() || channels.length === 0) {
      toast.push({ tone: "warning", message: "Write a caption and pick at least one channel." });
      return;
    }
    toast.push({
      tone: "info",
      message:
        "Compose drafts attach to the next accomplishment publish. Open an accomplishment to finalise cross-posting.",
    });
  }

  return (
    <Page>
      <PageTitle>Social</PageTitle>

      {!status ? (
        <div>
          <Skeleton height={44} />
          <div style={{ height: 12 }} />
          <Skeleton height={160} />
        </div>
      ) : (
        <>
          <SegmentedControl
            label="Social view"
            options={TABS}
            value={tab}
            onChange={(v) => setTab(v)}
          />

          {!status.enabled && (
            <Banner tone="warning" title="Cross-posting is disabled">
              Set <code>SOCIAL_ENABLED=true</code>, <code>SOCIAL_TOKEN_KEY</code>,{" "}
              <code>SOCIAL_OAUTH_CALLBACK_BASE</code>, and the per-platform credentials.
            </Banner>
          )}

          {err && (
            <Banner
              tone="danger"
              title="Couldn't load social"
              action={
                <Button variant="ghost" size="sm" onClick={() => void load()}>
                  Retry
                </Button>
              }
            >
              {err}
            </Banner>
          )}

          {tab === "compose" && (
            <ComposeArea>
              <Card>
                <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 15 }}>Caption</h3>
                <Editor
                  value={compose}
                  onChange={(e) => setCompose(e.target.value)}
                  placeholder="What do you want to share? Keep it short for X."
                  aria-label="Compose caption"
                />
                <h3 style={{ marginTop: 16, marginBottom: 8, fontSize: 15 }}>Channels</h3>
                <ChannelChips>
                  {CHANNELS.map((c) => (
                    <FilterChip
                      key={c.value}
                      active={channels.includes(c.value)}
                      onClick={() =>
                        setChannels((prev) =>
                          prev.includes(c.value)
                            ? prev.filter((x) => x !== c.value)
                            : [...prev, c.value]
                        )
                      }
                    >
                      {c.label}
                    </FilterChip>
                  ))}
                </ChannelChips>
                <div style={{ height: 12 }} />
                <CharCount>
                  {CHANNELS.filter((c) => channels.includes(c.value)).map((c) => {
                    const over = compose.length > c.limit;
                    return (
                      <CountChip key={c.value} $over={over}>
                        <span>{c.label}</span>
                        <span>
                          {compose.length}/{c.limit}
                        </span>
                      </CountChip>
                    );
                  })}
                </CharCount>
                <BottomBar>
                  <Button variant="secondary" onClick={() => setScheduleOpen(true)}>
                    Schedule…
                  </Button>
                  <Button
                    onClick={postNow}
                    disabled={!compose.trim() || channels.length === 0}
                  >
                    Post
                  </Button>
                </BottomBar>
              </Card>

              <Card>
                <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 15 }}>Connections</h3>
                {status.platforms.map((p) => {
                  const active = conns.find(
                    (c) => c.platform === p.platform && c.status === "active"
                  );
                  const errored = conns.find(
                    (c) => c.platform === p.platform && c.status === "error"
                  );
                  return (
                    <ListRow
                      key={p.platform}
                      leading={<PlatformIcon platform={p.platform} />}
                      title={<span style={{ textTransform: "capitalize" }}>{p.platform}</span>}
                      meta={
                        active
                          ? `Connected: ${active.channel_name}`
                          : errored
                            ? `Error — ${errored.last_error ?? "reconnect required"}`
                            : "Not connected"
                      }
                      trailing={
                        active ? (
                          <Badge tone="success">Live</Badge>
                        ) : errored ? (
                          <Badge tone="danger">Error</Badge>
                        ) : (
                          <Badge tone="neutral">Off</Badge>
                        )
                      }
                      onClick={() => {
                        if (p.configured) {
                          if (active) setConfirmRevoke(active);
                          else void connect(p.platform);
                        } else {
                          toast.push({
                            tone: "warning",
                            message: `${p.platform} credentials aren't configured.`,
                          });
                        }
                      }}
                    />
                  );
                })}
              </Card>
            </ComposeArea>
          )}

          {tab !== "compose" && (
            <>
              <ChannelChips>
                <FilterChip
                  active={filterPlatform === "all"}
                  onClick={() => setFilterPlatform("all")}
                >
                  All
                </FilterChip>
                {CHANNELS.map((c) => (
                  <FilterChip
                    key={c.value}
                    active={filterPlatform === c.value}
                    onClick={() => setFilterPlatform(c.value as Platform)}
                  >
                    {c.label}
                  </FilterChip>
                ))}
              </ChannelChips>

              {tab === "scheduled" && <PostList posts={filteredList(scheduled)} onRetry={retry} empty="Nothing scheduled." />}
              {tab === "published" && <PostList posts={filteredList(published)} onRetry={retry} empty="Nothing published yet." />}
              {tab === "analytics" && (
                <>
                  <StatRow>
                    <StatTile label="Posts (14d)" value={posts.length} trend={trend} />
                    <StatTile label="Published" value={published.length} />
                    <StatTile label="Scheduled" value={scheduled.length} />
                    <StatTile
                      label="Failed"
                      value={posts.filter((p) => p.state === "failed").length}
                    />
                  </StatRow>
                  <Card>
                    <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 14 }}>
                      Last 14 days
                    </h3>
                    <TrendLine values={trend} height={56} />
                  </Card>
                  <Card>
                    <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 14 }}>
                      Per channel
                    </h3>
                    {Object.keys(perChannel).length === 0 ? (
                      <p style={{ color: "var(--am-ink-muted)", margin: 0 }}>No activity yet.</p>
                    ) : (
                      Object.entries(perChannel).map(([k, v]) => (
                        <ListRow
                          key={k}
                          leading={<PlatformIcon platform={k as Platform} />}
                          title={<span style={{ textTransform: "capitalize" }}>{k}</span>}
                          meta={`Posted ${v.posted} · Failed ${v.failed} · Queued ${v.queued}`}
                          chevron={false}
                        />
                      ))
                    )}
                  </Card>
                </>
              )}
            </>
          )}
        </>
      )}

      {/* Schedule sheet */}
      <Sheet
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        title="Schedule post"
        description="Pick a date and time (your local timezone)."
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
            <Button fullWidth disabled={!scheduleAt} onClick={schedule}>
              Schedule
            </Button>
          </>
        }
      >
        <Field>
          <span>Scheduled for</span>
          <Input
            type="datetime-local"
            value={scheduleAt}
            onChange={(e) => setScheduleAt(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
          />
        </Field>
      </Sheet>

      {/* Revoke confirm (uses Modal directly to name subject per §10) */}
      <Modal
        open={!!confirmRevoke}
        onClose={() => setConfirmRevoke(null)}
        title={
          confirmRevoke
            ? `Revoke ${confirmRevoke.platform} connection?`
            : "Revoke connection?"
        }
        description={
          confirmRevoke
            ? `This stops future posts to ${confirmRevoke.channel_name}. Historical posts stay visible.`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmRevoke(null)}>
              Keep
            </Button>
            <Button variant="danger" onClick={() => confirmRevoke && revoke(confirmRevoke)}>
              Revoke
            </Button>
          </>
        }
      >
        <div />
      </Modal>
    </Page>
  );
}

function PostList({
  posts,
  onRetry,
  empty,
}: {
  posts: Post[];
  onRetry: (id: string) => void;
  empty: string;
}) {
  if (posts.length === 0) {
    return (
      <Card padding="none">
        <EmptyState title="Nothing to show" description={empty} />
      </Card>
    );
  }
  return (
    <ListWrap>
      {posts.map((p) => (
        <ListRow
          key={p.id}
          leading={<PlatformIcon platform={p.platform} />}
          title={p.caption ?? `Post ${p.id.slice(-6)}`}
          meta={
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              {new Date(p.created_at).toLocaleString()} · {p.attempts} attempt
              {p.attempts === 1 ? "" : "s"}
              {p.last_error ? ` · ${p.last_error}` : ""}
            </span>
          }
          trailing={
            <span style={{ display: "inline-flex", gap: 6 }}>
              <Badge tone={stateTone(p.state)}>{p.state}</Badge>
              {(p.state === "failed" || p.state === "skipped") && (
                <Button size="sm" variant="ghost" onClick={() => onRetry(p.id)}>
                  Retry
                </Button>
              )}
            </span>
          }
          href={p.external_url ?? undefined}
          chevron={!!p.external_url}
        />
      ))}
    </ListWrap>
  );
}

/* ================================================================= */
/* Legacy fallback                                                    */
/* ================================================================= */

function LegacySocial() {
  const toast = useToast();
  const search = useSearchParams();
  const [status, setStatus] = useState<Status | null>(null);
  const [conns, setConns] = useState<Connection[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [s, c, p] = await Promise.all([
        api<Status>("/social/platforms"),
        api<Connection[]>("/social/connections"),
        api<Post[]>("/social/posts?limit=50"),
      ]);
      setStatus(s);
      setConns(c);
      setPosts(p);
    } catch (e) {
      setErr((e as ApiClientError).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const name = search.get("connected");
    if (name) toast.push({ tone: "success", message: `${name} connected` });
  }, [search, toast]);

  async function connect(platform: Platform) {
    try {
      const r = await api<{ url: string }>(`/social/connections/${platform}/begin`, {
        json: {},
      });
      window.location.href = r.url;
    } catch (e) {
      toast.push({
        tone: "danger",
        message: (e as ApiClientError).message,
      });
    }
  }

  async function revoke(id: string) {
    if (!window.confirm("Revoke this connection?")) return;
    try {
      await api(`/social/connections/${id}/revoke`, { json: {} });
      toast.push({ tone: "success", message: "Revoked" });
      await load();
    } catch (e) {
      toast.push({ tone: "danger", message: (e as ApiClientError).message });
    }
  }

  async function retry(id: string) {
    try {
      await api(`/social/posts/${id}/retry`, { json: {} });
      toast.push({ tone: "success", message: "Retry queued" });
      await load();
    } catch (e) {
      toast.push({ tone: "danger", message: (e as ApiClientError).message });
    }
  }

  if (err) return <ErrorState message={err} retry={load} />;
  if (!status) return <LoadingState />;

  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Social cross-posting</h1>
      {!status.enabled ? (
        <aside
          style={{
            background: "#fef3c7",
            border: "1px solid #f59e0b",
            padding: "0.75rem 1rem",
            borderRadius: 6,
            marginBottom: "1rem",
          }}
        >
          Cross-posting is disabled on this environment.
        </aside>
      ) : null}
      <section>
        <h2 style={{ fontSize: "1.1rem" }}>Connections</h2>
        <ul style={{ listStyle: "none", paddingLeft: 0 }}>
          {status.platforms.map((p) => {
            const active = conns.find(
              (c) => c.platform === p.platform && c.status === "active"
            );
            return (
              <li
                key={p.platform}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: "0.75rem 1rem",
                  marginBottom: "0.5rem",
                  background: "#fff",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong style={{ textTransform: "capitalize" }}>{p.platform}</strong>
                  {active ? (
                    <span style={{ color: "#15803d" }}>Connected: {active.channel_name}</span>
                  ) : (
                    <span style={{ color: "#6b7280" }}>Not connected</span>
                  )}
                </div>
                <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem" }}>
                  {p.configured ? (
                    <LegacyButton onClick={() => void connect(p.platform)}>
                      {active ? "Reconnect" : "Connect"}
                    </LegacyButton>
                  ) : (
                    <small style={{ color: "#6b7280" }}>Credentials not configured.</small>
                  )}
                  {active ? (
                    <LegacyButton variant="ghost" onClick={() => void revoke(active.id)}>
                      Revoke
                    </LegacyButton>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      <section style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>Recent posts</h2>
        {posts.length === 0 ? (
          <p style={{ color: "#6b7280" }}>Nothing yet.</p>
        ) : (
          <ul style={{ listStyle: "none", paddingLeft: 0 }}>
            {posts.map((p) => (
              <li
                key={p.id}
                style={{
                  border: "1px solid #e5e7eb",
                  padding: "0.5rem 0.75rem",
                  borderRadius: 6,
                  marginBottom: "0.5rem",
                  background: "#fff",
                }}
              >
                <strong>{p.platform}</strong> — {p.state}
                {p.external_url ? (
                  <> · <a href={p.external_url} target="_blank" rel="noreferrer">open</a></>
                ) : null}
                {(p.state === "failed" || p.state === "skipped") ? (
                  <> · <LegacyButton variant="ghost" onClick={() => void retry(p.id)}>Retry</LegacyButton></>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
