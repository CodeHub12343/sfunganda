"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api";

type Result = { user_id: string; linked_donations: number };

export function VerifyClient({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "pending" | "ok" | "fail">("pending");
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!token) {
      setState("fail");
      setErr("Missing token.");
      return;
    }
    void (async () => {
      try {
        const r = await api<Result>("/supporters/verify", { json: { token } });
        setResult(r);
        setState("ok");
      } catch (e) {
        setErr((e as ApiClientError).message);
        setState("fail");
      }
    })();
  }, [token]);

  if (state === "pending") return <p>Verifying…</p>;
  if (state === "fail") {
    return (
      <div role="alert">
        <p style={{ color: "#dc2626" }}>{err}</p>
        <ResendForm />
      </div>
    );
  }
  return (
    <div role="status" style={{ background: "#ecfdf5", border: "1px solid #10b981", padding: "1.5rem", borderRadius: 10 }}>
      <h2 style={{ marginTop: 0 }}>Email confirmed</h2>
      <p>
        Your account is active.
        {result && result.linked_donations > 0 ? (
          <>
            {" "}
            We&apos;ve linked <strong>{result.linked_donations}</strong> previous
            donation{result.linked_donations === 1 ? "" : "s"} to your account.
          </>
        ) : null}
      </p>
      <p>
        <Link href="/sign-in">Sign in</Link> to see your dashboard.
      </p>
    </div>
  );
}

function ResendForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api("/supporters/resend-verification", { json: { email } });
        } finally {
          setSent(true);
        }
      }}
      style={{ marginTop: "1rem" }}
    >
      <p>Enter the email you signed up with and we&apos;ll send a fresh link.</p>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        style={{ padding: "0.6rem", border: "1px solid #e5e7eb", borderRadius: 6, width: "100%" }}
      />
      <button
        type="submit"
        disabled={sent}
        style={{
          marginTop: "0.6rem",
          padding: "0.7rem 1.1rem",
          background: "#111827",
          color: "#fff",
          borderRadius: 8,
          border: 0,
          cursor: "pointer",
        }}
      >
        {sent ? "If that account exists, a link was sent." : "Send another link"}
      </button>
    </form>
  );
}
