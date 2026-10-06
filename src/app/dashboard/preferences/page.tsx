"use client";

import { useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
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

const FREQS: Freq[] = ["immediate", "daily_digest", "weekly_digest", "off"];

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
    <section>
      <h1>Preferences</h1>
      <section style={card}>
        <h2 style={{ marginTop: 0 }}>Channels</h2>
        <label>
          <input
            type="checkbox"
            checked={prefs.channels.email}
            onChange={(e) =>
              setPrefs({ ...prefs, channels: { ...prefs.channels, email: e.target.checked } })
            }
          />{" "}
          Email
        </label>
        <br />
        <label>
          <input
            type="checkbox"
            checked={prefs.channels.in_app}
            onChange={(e) =>
              setPrefs({ ...prefs, channels: { ...prefs.channels, in_app: e.target.checked } })
            }
          />{" "}
          In-app
        </label>
        <br />
        <label style={{ marginTop: "0.75rem", display: "block", color: "#dc2626" }}>
          <input
            type="checkbox"
            checked={prefs.unsubscribed_all}
            onChange={(e) => setPrefs({ ...prefs, unsubscribed_all: e.target.checked })}
          />{" "}
          Pause all notifications
        </label>
      </section>

      <section style={card}>
        <h2 style={{ marginTop: 0 }}>What to receive</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th>Topic</th>
              {FREQS.map((f) => (
                <th key={f}>{f.replace("_", " ")}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Row
              label="Project updates I follow"
              value={prefs.accomplishment_published}
              onChange={(v) => setPrefs({ ...prefs, accomplishment_published: v })}
            />
            <Row
              label="Milestones completed"
              value={prefs.milestone_completed}
              onChange={(v) => setPrefs({ ...prefs, milestone_completed: v })}
            />
            <Row
              label="Project activity"
              value={prefs.project_update}
              onChange={(v) => setPrefs({ ...prefs, project_update: v })}
            />
            <Row
              label="Donation receipts"
              value={prefs.donation_receipt}
              onChange={(v) => setPrefs({ ...prefs, donation_receipt: v })}
            />
          </tbody>
        </table>
      </section>

      <section style={card}>
        <h2 style={{ marginTop: 0 }}>Public listing</h2>
        <label>
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
          />{" "}
          List me as anonymous on the public donor wall
        </label>
      </section>

      <Button variant="primary" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save preferences"}
      </Button>
    </section>
  );
}

function Row({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Freq;
  onChange: (v: Freq) => void;
}) {
  return (
    <tr style={{ borderTop: "1px solid #e5e7eb" }}>
      <td style={{ padding: "0.5rem" }}>{label}</td>
      {FREQS.map((f) => (
        <td key={f} style={{ padding: "0.5rem", textAlign: "center" }}>
          <input
            type="radio"
            name={label}
            checked={value === f}
            onChange={() => onChange(f)}
            aria-label={`${label}: ${f.replace("_", " ")}`}
          />
        </td>
      ))}
    </tr>
  );
}

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: "1rem 1.25rem",
  marginBottom: "1.25rem",
};
