"use client";

import Link from "next/link";
import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";

export function UnsubscribeClient({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "pending" | "ok" | "fail">("idle");
  const [err, setErr] = useState<string | null>(null);

  async function confirm() {
    setState("pending");
    try {
      const r = await api<{ ok: boolean }>(`/supporters/unsubscribe?token=${encodeURIComponent(token)}`);
      setState(r.ok ? "ok" : "fail");
      if (!r.ok) setErr("That link isn't valid or has already been used.");
    } catch (e) {
      setErr((e as ApiClientError).message);
      setState("fail");
    }
  }

  if (!token) {
    return <p>Open the unsubscribe link from the email we sent you.</p>;
  }

  if (state === "idle") {
    return (
      <>
        <p>Click to turn off all notification emails from Sarah&apos;s Foundation.</p>
        <button
          onClick={confirm}
          style={{
            padding: "0.8rem 1.2rem",
            background: "#111827",
            color: "#fff",
            border: 0,
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Unsubscribe from all emails
        </button>
      </>
    );
  }
  if (state === "pending") return <p>Working…</p>;
  if (state === "ok")
    return (
      <div role="status">
        <p>You&apos;ve been unsubscribed. You can re-enable individual notifications anytime from your preferences.</p>
        <p>
          <Link href="/dashboard">Go to dashboard</Link>
        </p>
      </div>
    );
  return <p role="alert">{err}</p>;
}
