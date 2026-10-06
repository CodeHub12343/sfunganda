"use client";

import { useCallback, useEffect, useState } from "react";

// =============================================================================
// Public-side language picker for a video's summary (§14.8, R-D).
//
// Fetches /public/videos/:id/summary?lang=xx and renders the result. The
// "machine-translated" badge is required by the design — translated text
// always carries a label so visitors know it isn't editorial copy.
// =============================================================================

export const SUPPORTED_LANGUAGES: Array<{ code: string; label: string }> = [
  { code: "en", label: "English" },
  { code: "lg", label: "Luganda" },
  { code: "sw", label: "Swahili" },
  { code: "fr", label: "Français" },
  { code: "ar", label: "العربية" },
];

type ApiPayload = {
  language: string;
  text: string;
  is_source: boolean;
  machine_translated: boolean;
};

export function VideoSummaryPicker({ videoId }: { videoId: string }) {
  const [lang, setLang] = useState<string>("en");
  const [data, setData] = useState<ApiPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const load = useCallback(async (l: string) => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/v1/public/videos/${encodeURIComponent(videoId)}/summary?lang=${encodeURIComponent(l)}`);
      if (r.status === 404) {
        setData(null);
        setErr(null);
        return;
      }
      if (!r.ok) throw new Error(`http ${r.status}`);
      const j = (await r.json()) as { data: ApiPayload };
      setData(j.data);
    } catch {
      setErr("Translation unavailable — showing the English summary.");
      try {
        const r2 = await fetch(`/api/v1/public/videos/${encodeURIComponent(videoId)}/summary?lang=en`);
        if (r2.ok) {
          const j2 = (await r2.json()) as { data: ApiPayload };
          setData(j2.data);
        }
      } catch {
        /* leave the error on screen */
      }
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    void load(lang);
  }, [lang, load]);

  if (!data && !err && !loading) return null;

  return (
    <aside style={{ marginTop: "0.75rem", padding: "0.75rem 1rem", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8 }}>
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.5rem" }}>
        <strong style={{ fontSize: "0.9rem" }}>Summary</strong>
        <label style={{ fontSize: "0.85rem" }}>
          Language{" "}
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            aria-label="Summary language"
            style={{ fontSize: "0.85rem" }}
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        {data?.machine_translated ? (
          <span
            title="This summary was translated by a machine. The English version is authoritative."
            style={{ background: "#fef3c7", color: "#92400e", padding: "0 0.4rem", borderRadius: 4, fontSize: "0.75rem" }}
          >
            Machine-translated
          </span>
        ) : null}
      </div>
      {loading ? <p style={{ margin: 0, color: "#6b7280" }}>Loading…</p> : null}
      {err ? <p style={{ margin: 0, color: "#9a3412", fontSize: "0.85rem" }}>{err}</p> : null}
      {data?.text ? <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{data.text}</p> : null}
    </aside>
  );
}
