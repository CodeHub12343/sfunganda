"use client";

import { useCallback, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { Button } from "@/components/ui/Button";

// =============================================================================
// Phase 10 — "Draft description" panel for the review screen.
//
// What this component does:
//   • Calls POST /ai/draft/accomplishment with the current accomplishment id.
//   • Renders each returned field side-by-side with highlighted spans that
//     the server validator flagged as unverified (unknown number, date,
//     name, place). Reviewers see the problematic spans in red so they
//     cannot miss them (§17.2 step 4 / §17.3).
//   • Keeps a "Keep" toggle per field; marking any field flips
//     `ai_assisted = true` on the accomplishment via the acceptance call,
//     which arms the publish-time attestation gate.
//
// Error handling:
//   • Provider timeout / disabled → message tells the user to write the
//     description manually. The button is still available for retry.
//   • Rate-limited (per-user or per-org daily cap) → surfaces the limit.
//   • Validation failed on the server (not provider-side) → the fields
//     still render but no "Keep" buttons until the reviewer confirms.
// =============================================================================

export type AiFields = {
  title: string;
  body: string;
  why_it_matters: string;
  next_steps: string;
  facts_used: string[];
};

type Highlight = { field: string; text: string; reason: string };

type DraftResult = {
  generation_id: string;
  provider: string;
  model: string;
  fields: AiFields | null;
  validation: { ok: boolean; findings: Array<{ kind: string; span: string; field?: string }>; highlights: Highlight[] };
  name_map: Record<string, string>;
  error_code: string | null;
  error_message: string | null;
};

const FIELD_LABELS: Record<keyof AiFields, string> = {
  title: "Title",
  body: "Body",
  why_it_matters: "Why it matters",
  next_steps: "Next steps",
  facts_used: "Facts used",
};

export function AiDraftPanel(props: {
  accomplishmentId: string;
  seedBody?: string;
  onAccepted: (fields: Partial<AiFields>, kept: Array<keyof AiFields>) => void;
}) {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [result, setResult] = useState<DraftResult | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [kept, setKept] = useState<Record<string, boolean>>({});

  const start = useCallback(async () => {
    setState("loading");
    setErrMsg(null);
    try {
      const data = await api<DraftResult>("/ai/draft/accomplishment", {
        json: { accomplishment_id: props.accomplishmentId, seed_body: props.seedBody },
      });
      setResult(data);
      setState("ready");
    } catch (e) {
      const err = e as ApiClientError;
      setErrMsg(
        err.code === "rate_limited"
          ? "You have reached today's drafting limit. Please write the description manually."
          : err.code === "not_found"
          ? "Drafting is unavailable right now. Please write the description manually."
          : err.message
      );
      setState("error");
    }
  }, [props.accomplishmentId, props.seedBody]);

  const accept = useCallback(async () => {
    if (!result?.fields) return;
    const kf = (Object.keys(kept) as Array<keyof AiFields>).filter((k) => kept[k]);
    try {
      await api(`/ai/draft/acceptance`, {
        json: { generation_id: result.generation_id, accepted: kf.length > 0, kept_fields: kf },
      });
      const picked: Partial<AiFields> = {};
      for (const k of kf) picked[k] = result.fields[k] as never;
      props.onAccepted(picked, kf);
    } catch (e) {
      setErrMsg((e as ApiClientError).message);
    }
  }, [kept, result, props]);

  const discard = useCallback(async () => {
    if (!result) return;
    try {
      await api(`/ai/draft/acceptance`, {
        json: { generation_id: result.generation_id, accepted: false, kept_fields: [] },
      });
    } catch {
      // Best-effort; discarding never blocks the UI.
    }
    setResult(null);
    setKept({});
    setState("idle");
  }, [result]);

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: "1rem",
        background: "#fafafa",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>AI drafting assistant</strong>
        {state === "idle" ? (
          <Button variant="secondary" onClick={() => void start()}>
            Draft description
          </Button>
        ) : null}
        {state === "loading" ? <span style={{ color: "#6b7280" }}>Drafting…</span> : null}
        {state === "ready" && result ? (
          <small style={{ color: "#6b7280" }}>
            {result.provider} / {result.model}
          </small>
        ) : null}
      </div>

      {state === "idle" ? (
        <p style={{ color: "#6b7280", margin: "0.5rem 0 0" }}>
          Produces a candidate title, body, and context from the field report. Any new
          number, name, or date is flagged so you can check it. Nothing is saved until
          you accept.
        </p>
      ) : null}

      {state === "error" ? (
        <p style={{ color: "#b91c1c", margin: "0.5rem 0 0" }}>
          {errMsg}
          <br />
          <button
            type="button"
            onClick={() => void start()}
            style={{ marginTop: "0.5rem", background: "none", border: 0, color: "#374151", textDecoration: "underline", cursor: "pointer" }}
          >
            Try again
          </button>
        </p>
      ) : null}

      {state === "ready" && result ? (
        <div style={{ marginTop: "0.75rem" }}>
          {result.error_code ? (
            <p style={{ color: "#b91c1c" }}>
              Drafting failed ({result.error_code}). Please write the description
              manually.
            </p>
          ) : null}
          {!result.validation.ok && result.fields ? (
            <div
              role="alert"
              style={{
                background: "#fef3c7",
                border: "1px solid #f59e0b",
                padding: "0.5rem 0.75rem",
                borderRadius: 6,
                marginBottom: "0.75rem",
                fontSize: "0.9rem",
              }}
            >
              The draft contains {result.validation.findings.length} span(s) that are
              not in the field report. They are highlighted below — confirm each one
              is correct before you accept.
            </div>
          ) : null}
          {result.fields
            ? (Object.keys(FIELD_LABELS) as Array<keyof AiFields>).map((f) => {
                if (f === "facts_used") {
                  return (
                    <section key={f} style={{ marginTop: "0.75rem" }}>
                      <h4 style={{ margin: "0 0 0.25rem" }}>Facts used</h4>
                      <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#6b7280", fontSize: "0.9rem" }}>
                        {result.fields!.facts_used.map((fct, i) => (
                          <li key={i}>{fct}</li>
                        ))}
                      </ul>
                    </section>
                  );
                }
                const highlights = result.validation.highlights.filter((h) => h.field === f);
                return (
                  <section key={f} style={{ marginTop: "0.75rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h4 style={{ margin: 0 }}>{FIELD_LABELS[f]}</h4>
                      <label style={{ fontSize: "0.85rem" }}>
                        <input
                          type="checkbox"
                          checked={Boolean(kept[f])}
                          onChange={(e) => setKept({ ...kept, [f]: e.target.checked })}
                        />{" "}
                        Keep
                      </label>
                    </div>
                    <HighlightedText text={result.fields![f] as string} highlights={highlights} />
                  </section>
                );
              })
            : null}
          <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
            <Button variant="primary" onClick={() => void accept()} disabled={!result.fields}>
              Accept into draft
            </Button>
            <Button variant="ghost" onClick={() => void discard()}>
              Discard
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Render text with highlighted spans. Spans are plain strings; we locate
// every occurrence (word-boundary insensitive, case-insensitive) and wrap
// them. On overlap, the first match wins — good enough for operator UI.
function HighlightedText({ text, highlights }: { text: string; highlights: Highlight[] }) {
  if (!text) return <em style={{ color: "#9ca3af" }}>(empty)</em>;
  if (highlights.length === 0)
    return <div style={{ whiteSpace: "pre-wrap", padding: "0.5rem", background: "#fff", borderRadius: 6, border: "1px solid #e5e7eb" }}>{text}</div>;

  const needles = [...new Set(highlights.map((h) => h.text))].filter(Boolean);
  const parts: Array<{ s: string; hi: Highlight | null }> = [{ s: text, hi: null }];
  for (const n of needles) {
    const hi = highlights.find((h) => h.text === n) ?? null;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]!;
      if (p.hi) continue;
      const idx = p.s.toLowerCase().indexOf(n.toLowerCase());
      if (idx < 0) continue;
      const before = p.s.slice(0, idx);
      const mid = p.s.slice(idx, idx + n.length);
      const after = p.s.slice(idx + n.length);
      parts.splice(i, 1, { s: before, hi: null }, { s: mid, hi }, { s: after, hi: null });
      i += 2;
    }
  }

  return (
    <div style={{ whiteSpace: "pre-wrap", padding: "0.5rem", background: "#fff", borderRadius: 6, border: "1px solid #e5e7eb" }}>
      {parts.map((p, i) =>
        p.hi ? (
          <mark
            key={i}
            title={p.hi.reason}
            style={{ background: "#fecaca", color: "#991b1b", padding: "0 2px", borderRadius: 3 }}
          >
            {p.s}
          </mark>
        ) : (
          <span key={i}>{p.s}</span>
        )
      )}
    </div>
  );
}
