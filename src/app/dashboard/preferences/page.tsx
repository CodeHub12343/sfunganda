"use client";

import { useEffect, useState } from "react";
import styled from "styled-components";
import { api, ApiClientError } from "@/lib/api";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";

export const dynamic = "force-dynamic";

type Freq = "immediate" | "daily_digest" | "weekly_digest" | "off";
type Prefs = {
  accomplishment_published: Freq;
  milestone_completed: Freq;
  project_update: Freq;
  donation_receipt: Freq;
  channels: { email: boolean; in_app: boolean };
  unsubscribed_all: boolean;
};

const FREQS: { value: Freq; label: string }[] = [
  { value: "immediate", label: "Immediate" },
  { value: "daily_digest", label: "Daily digest" },
  { value: "weekly_digest", label: "Weekly digest" },
  { value: "off", label: "Off" },
];

const TOPICS: {
  key: keyof Omit<Prefs, "channels" | "unsubscribed_all">;
  label: string;
  blurb: string;
}[] = [
  {
    key: "accomplishment_published",
    label: "Project updates I follow",
    blurb: "New accomplishments from projects on your follow list.",
  },
  {
    key: "milestone_completed",
    label: "Milestones completed",
    blurb: "When a project reaches an outcome you helped fund.",
  },
  {
    key: "project_update",
    label: "Project activity",
    blurb: "Significant program changes and news from the field.",
  },
  {
    key: "donation_receipt",
    label: "Donation receipts",
    blurb: "Acknowledgements and recurring giving confirmations.",
  },
];

export default function PreferencesPage() {
  const toast = useToast();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const d = await api<{ anonymous_on_wall: boolean; prefs: Prefs }>("/me/preferences");
        setPrefs(d.prefs);
        setAnonymous(d.anonymous_on_wall);
      } catch (e) {
        setErr((e as ApiClientError).message);
      }
    })();
  }, []);

  async function save() {
    if (!prefs) return;
    setSaving(true);
    try {
      await api("/me/preferences", {
        method: "PATCH",
        json: { anonymous_on_wall: anonymous, prefs },
      });
      toast.push({ tone: "success", message: "Preferences saved" });
    } catch (e) {
      toast.push({ tone: "danger", message: (e as ApiClientError).message });
    } finally {
      setSaving(false);
    }
  }

  if (err) return <ErrorState message={err} />;
  if (!prefs) return <LoadingState />;

  return (
    <Page>
      <Header>
        <Eyebrow>Preferences</Eyebrow>
        <Title>How we talk with you</Title>
        <Lede>
          Decide which notifications you&apos;d like to receive, through which channel, and
          how your name appears on our public donor wall.
        </Lede>
      </Header>

      <Grid>
        <Card>
          <CardHead>
            <h2>Channels</h2>
            <p>Where should we reach you?</p>
          </CardHead>
          <ToggleRow>
            <Switch>
              <input
                type="checkbox"
                checked={prefs.channels.email}
                onChange={(e) =>
                  setPrefs({
                    ...prefs,
                    channels: { ...prefs.channels, email: e.target.checked },
                  })
                }
              />
              <SwitchTrack />
              <SwitchText>
                <strong>Email</strong>
                <span>Receipts, digests, and milestone recaps.</span>
              </SwitchText>
            </Switch>
            <Switch>
              <input
                type="checkbox"
                checked={prefs.channels.in_app}
                onChange={(e) =>
                  setPrefs({
                    ...prefs,
                    channels: { ...prefs.channels, in_app: e.target.checked },
                  })
                }
              />
              <SwitchTrack />
              <SwitchText>
                <strong>In‑app</strong>
                <span>Notifications visible when you sign in.</span>
              </SwitchText>
            </Switch>
          </ToggleRow>

          <Danger>
            <Switch>
              <input
                type="checkbox"
                checked={prefs.unsubscribed_all}
                onChange={(e) => setPrefs({ ...prefs, unsubscribed_all: e.target.checked })}
              />
              <SwitchTrack $danger />
              <SwitchText>
                <strong>Pause all notifications</strong>
                <span>Temporarily silence every topic across all channels.</span>
              </SwitchText>
            </Switch>
          </Danger>
        </Card>

        <Card>
          <CardHead>
            <h2>Public listing</h2>
            <p>How your name appears on our donor wall.</p>
          </CardHead>
          <Switch>
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
            />
            <SwitchTrack />
            <SwitchText>
              <strong>List me as anonymous</strong>
              <span>Your donations will still count toward project totals.</span>
            </SwitchText>
          </Switch>
        </Card>
      </Grid>

      <TopicsCard>
        <CardHead>
          <h2>What to receive</h2>
          <p>Pick the cadence that fits each kind of update.</p>
        </CardHead>

        <TopicList>
          {TOPICS.map((t) => (
            <TopicRow key={t.key}>
              <TopicMeta>
                <strong>{t.label}</strong>
                <span>{t.blurb}</span>
              </TopicMeta>
              <FreqOptions role="radiogroup" aria-label={t.label}>
                {FREQS.map((f) => {
                  const active = prefs[t.key] === f.value;
                  return (
                    <FreqOption key={f.value} $active={active}>
                      <input
                        type="radio"
                        name={t.key}
                        checked={active}
                        onChange={() => setPrefs({ ...prefs, [t.key]: f.value })}
                        aria-label={`${t.label}: ${f.label}`}
                      />
                      <span>{f.label}</span>
                    </FreqOption>
                  );
                })}
              </FreqOptions>
            </TopicRow>
          ))}
        </TopicList>
      </TopicsCard>

      <SaveBar>
        <SaveNote>Changes apply the next time we deliver notifications.</SaveNote>
        <SaveBtn type="button" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save preferences"}
        </SaveBtn>
      </SaveBar>
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
  gap: 0.4rem;
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
  font-size: 0.98rem;
  max-width: 60ch;
  line-height: 1.5;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const Card = styled.section`
  background: #fff;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  box-shadow: ${({ theme }) => theme.shadow.ring};
  padding: 1.25rem 1.3rem;
  display: grid;
  gap: 1rem;
`;

const TopicsCard = styled(Card)``;

const CardHead = styled.div`
  display: grid;
  gap: 0.15rem;

  h2 {
    margin: 0;
    font-family: ${({ theme }) => theme.font.heading};
    font-size: 1.1rem;
    color: ${({ theme }) => theme.colors.trustBlue};
  }

  p {
    margin: 0;
    color: ${({ theme }) => theme.colors.inkMuted};
    font-size: 0.86rem;
  }
`;

const ToggleRow = styled.div`
  display: grid;
  gap: 0.8rem;
`;

const Switch = styled.label`
  display: grid;
  grid-template-columns: 44px 1fr;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  user-select: none;

  input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  input:focus-visible + div {
    outline: 3px solid ${({ theme }) => theme.colors.sunriseOrange};
    outline-offset: 2px;
  }
`;

const SwitchTrack = styled.div<{ $danger?: boolean }>`
  position: relative;
  width: 44px;
  height: 24px;
  border-radius: 999px;
  background: #e5e7eb;
  transition: background 180ms ease;

  &::after {
    content: "";
    position: absolute;
    top: 3px;
    left: 3px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
    transition: transform 180ms ease;
  }

  input:checked ~ & {
    background: ${({ theme, $danger }) =>
      $danger ? "#dc2626" : theme.colors.foundationGreen};
  }

  input:checked ~ &::after {
    transform: translateX(20px);
  }

  label:has(input:checked) & {
    background: ${({ theme, $danger }) =>
      $danger ? "#dc2626" : theme.colors.foundationGreen};
  }

  label:has(input:checked) &::after {
    transform: translateX(20px);
  }
`;

const SwitchText = styled.div`
  display: grid;
  gap: 0.1rem;

  strong {
    color: ${({ theme }) => theme.colors.ink};
    font-weight: 600;
    font-size: 0.95rem;
  }

  span {
    color: ${({ theme }) => theme.colors.inkMuted};
    font-size: 0.82rem;
    line-height: 1.4;
  }
`;

const Danger = styled.div`
  padding-top: 0.9rem;
  border-top: 1px dashed ${({ theme }) => theme.colors.border};
`;

const TopicList = styled.div`
  display: grid;
  gap: 0.75rem;
`;

const TopicRow = styled.div`
  display: grid;
  gap: 0.7rem;
  padding: 0.9rem 1rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.bgSoft};

  @media (min-width: 768px) {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
  }
`;

const TopicMeta = styled.div`
  display: grid;
  gap: 0.15rem;

  strong {
    color: ${({ theme }) => theme.colors.ink};
    font-weight: 600;
    font-size: 0.95rem;
  }

  span {
    color: ${({ theme }) => theme.colors.inkMuted};
    font-size: 0.82rem;
    line-height: 1.4;
  }
`;

const FreqOptions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
`;

const FreqOption = styled.label<{ $active: boolean }>`
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 0.4rem 0.75rem;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 160ms ease;

  background: ${({ $active, theme }) =>
    $active ? theme.gradients.sunrise : "#fff"};
  color: ${({ $active, theme }) => ($active ? "#1a0f00" : theme.colors.inkSoft)};
  border: 1px solid
    ${({ $active, theme }) => ($active ? "transparent" : theme.colors.border)};
  box-shadow: ${({ $active }) =>
    $active ? "0 4px 12px rgba(242, 140, 40, 0.3)" : "none"};

  input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  input:focus-visible + span {
    outline: 2px solid ${({ theme }) => theme.colors.sunriseOrange};
    outline-offset: 3px;
    border-radius: 999px;
  }

  &:hover {
    border-color: ${({ $active, theme }) =>
      $active ? "transparent" : theme.colors.trustBlue};
  }
`;

const SaveBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  justify-content: space-between;
  padding: 1rem 1.2rem;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.bgPremium};
  border: 1px solid ${({ theme }) => theme.colors.border};
`;

const SaveNote = styled.div`
  color: ${({ theme }) => theme.colors.inkMuted};
  font-size: 0.85rem;
`;

const SaveBtn = styled.button`
  appearance: none;
  border: none;
  cursor: pointer;
  padding: 0.7rem 1.3rem;
  border-radius: 999px;
  color: #1a0f00;
  font-weight: 700;
  font-size: 0.92rem;
  background: ${({ theme }) => theme.gradients.sunrise};
  box-shadow: ${({ theme }) => theme.shadow.glow};
  transition: transform 160ms ease;

  &:hover:not(:disabled),
  &:focus-visible:not(:disabled) {
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
`;
