"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";

export function SignupForm() {
  const [state, setState] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    display_name: "",
    password: "",
    country: "",
    consent: false,
    website: "",
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.consent) {
      setErr("Please accept the privacy notice to continue.");
      return;
    }
    setErr(null);
    setState("submitting");
    try {
      await api<{ ok: boolean }>("/supporters/signup", {
        json: {
          email: form.email,
          display_name: form.display_name,
          password: form.password,
          country: form.country || undefined,
          consent: true,
          website: form.website,
        },
      });
      setState("sent");
    } catch (e) {
      setState("error");
      setErr((e as ApiClientError).message);
    }
  }

  if (state === "sent") {
    return (
      <div
        role="status"
        style={{
          background: "#ecfdf5",
          border: "1px solid #10b981",
          borderRadius: 10,
          padding: "1.5rem",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Check your email</h2>
        <p>
          If an account can be created with that address, we&apos;ve sent a confirmation link.
          Click it to finish setting up your account.
        </p>
        <p style={{ color: "#6b7280", fontSize: "0.9rem", margin: 0 }}>
          Don&apos;t see it? Check your spam folder, or request another one from the verification page.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.9rem" }}>
      {err ? <p style={{ color: "#dc2626" }}>{err}</p> : null}
      <label>
        <span style={labelStyle}>Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          style={inputStyle}
        />
      </label>
      <label>
        <span style={labelStyle}>Display name</span>
        <input
          required
          autoComplete="name"
          value={form.display_name}
          onChange={(e) => setForm({ ...form, display_name: e.target.value })}
          style={inputStyle}
        />
      </label>
      <label>
        <span style={labelStyle}>Password (12+ characters)</span>
        <input
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          style={inputStyle}
        />
      </label>
      <label>
        <span style={labelStyle}>Country (optional)</span>
        <input
          value={form.country}
          onChange={(e) => setForm({ ...form, country: e.target.value })}
          style={inputStyle}
        />
      </label>
      {/* Honeypot — hidden from humans. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        value={form.website}
        onChange={(e) => setForm({ ...form, website: e.target.value })}
        style={{ position: "absolute", left: "-9999px", width: 0, height: 0, opacity: 0 }}
      />
      <label style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", fontSize: "0.9rem" }}>
        <input
          type="checkbox"
          checked={form.consent}
          onChange={(e) => setForm({ ...form, consent: e.target.checked })}
        />
        <span>
          I agree to Sarah&apos;s Foundation&apos;s privacy notice and understand that my email is
          used to send me the updates I subscribe to.
        </span>
      </label>
      <button
        type="submit"
        disabled={state === "submitting"}
        style={{
          padding: "0.9rem",
          background: "#111827",
          color: "#fff",
          border: 0,
          borderRadius: 10,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {state === "submitting" ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}

const labelStyle: React.CSSProperties = { display: "block", color: "#6b7280", fontSize: "0.85rem" };
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.65rem",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
};
