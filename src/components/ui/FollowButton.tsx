"use client";

import { useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api";

type Props = {
  projectId: string;
};

// Client-only follow button. Fetches the current follow set on mount so it
// renders correctly without a server round-trip in the page component.
// Anonymous users get a sign-in nudge.
export function FollowButton({ projectId }: Props) {
  const [state, setState] = useState<"loading" | "anon" | "following" | "not_following" | "pending">("loading");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const rows = await api<Array<{ project: { _id: string } }>>("/me/follows");
        setState(rows.some((r) => r.project._id === projectId) ? "following" : "not_following");
      } catch (e) {
        if ((e as ApiClientError).code === "unauthorized") setState("anon");
        else {
          setErr((e as ApiClientError).message);
          setState("not_following");
        }
      }
    })();
  }, [projectId]);

  async function toggle() {
    if (state === "anon") {
      const next = encodeURIComponent(window.location.pathname);
      window.location.href = `/sign-in?next=${next}`;
      return;
    }
    const prior = state;
    setState("pending");
    try {
      if (prior === "following") {
        await api(`/me/follows/${projectId}`, { method: "DELETE" });
        setState("not_following");
      } else {
        await api("/me/follows", { json: { project_id: projectId } });
        setState("following");
      }
    } catch (e) {
      setErr((e as ApiClientError).message);
      setState(prior as "following" | "not_following");
    }
  }

  const label =
    state === "loading"
      ? "…"
      : state === "pending"
        ? "Saving…"
        : state === "following"
          ? "✓ Following"
          : state === "anon"
            ? "Sign in to follow"
            : "Follow";

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={state === "loading" || state === "pending"}
        aria-pressed={state === "following"}
        style={{
          padding: "0.55rem 1rem",
          borderRadius: 999,
          border: state === "following" ? "1px solid #10b981" : "1px solid #111827",
          background: state === "following" ? "#ecfdf5" : "#111827",
          color: state === "following" ? "#065f46" : "#fff",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        {label}
      </button>
      {err ? (
        <small style={{ display: "block", color: "#dc2626", marginTop: "0.3rem" }}>{err}</small>
      ) : null}
    </>
  );
}
