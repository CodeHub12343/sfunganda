"use client";

import { useState } from "react";
import NextLink from "next/link";
import styled from "styled-components";
import { api, ApiClientError } from "@/lib/api";
import { Field, Input, Checkbox } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { media } from "@/styles/theme";

const Panel = styled.form`
  padding: 1.5rem;
  border-radius: ${({ theme }) => theme.radius.lg};
  background: ${({ theme }) => theme.colors.bg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.shadow.glass};
  display: grid;
  gap: 1rem;
  ${media.sm} {
    padding: 2rem;
  }
  ${media.md} {
    padding: 2.5rem;
  }
`;

const Success = styled.div`
  padding: 2rem;
  border-radius: ${({ theme }) => theme.radius.lg};
  background: ${({ theme }) => theme.colors.warmCream};
  border: 1px solid ${({ theme }) => theme.colors.foundationGreen};
  box-shadow: ${({ theme }) => theme.shadow.soft};
  h2 {
    margin: 0 0 0.6rem;
    color: ${({ theme }) => theme.colors.trustBlue};
    font-family: ${({ theme }) => theme.font.heading};
  }
  p {
    color: ${({ theme }) => theme.colors.inkSoft};
    margin: 0 0 0.6rem;
  }
`;

const FormError = styled.p`
  color: ${({ theme }) => theme.colors.sunriseOrange};
  background: #fff7ed;
  border: 1px solid #fed7aa;
  padding: 0.6rem 0.8rem;
  border-radius: ${({ theme }) => theme.radius.md};
  margin: 0;
  font-size: 0.9rem;
`;

const Reassure = styled.p`
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.inkMuted};
  text-align: center;
  margin: 0;
`;

const Hint = styled.p`
  font-size: 0.9rem;
  color: ${({ theme }) => theme.colors.inkSoft};
  margin: 0;
  a {
    color: ${({ theme }) => theme.colors.trustBlue};
    font-weight: ${({ theme }) => theme.weight.semibold};
    text-decoration: underline;
    text-underline-offset: 3px;
  }
`;

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
      setState("error");
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
      <Success role="status">
        <h2>Welcome aboard!</h2>
        <p>
          Your supporter account is ready. Sign in with the email and password
          you just chose to start following projects and tracking donations.
        </p>
        <p>
          <NextLink href="/sign-in">Go to sign in →</NextLink>
        </p>
      </Success>
    );
  }

  return (
    <Panel onSubmit={onSubmit} noValidate>
      {err ? <FormError>{err}</FormError> : null}

      <Field label="Email" required>
        {(p) => (
          <Input
            {...p}
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        )}
      </Field>

      <Field label="Display name" required>
        {(p) => (
          <Input
            {...p}
            required
            autoComplete="name"
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
          />
        )}
      </Field>

      <Field label="Password (12+ characters)" required>
        {(p) => (
          <Input
            {...p}
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        )}
      </Field>

      <Field label="Country">
        {(p) => (
          <Input
            {...p}
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
          />
        )}
      </Field>

      {/* Honeypot — hidden from humans. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        value={form.website}
        onChange={(e) => setForm({ ...form, website: e.target.value })}
        style={{ position: "absolute", left: "-9999px", width: 0, height: 0, opacity: 0 }}
        aria-hidden
      />

      <Checkbox
        checked={form.consent}
        onChange={(v) => setForm({ ...form, consent: v })}
      >
        I agree to Sarah&apos;s Foundation&apos;s privacy notice and
        understand my email is used to send the updates I subscribe to.
      </Checkbox>

      <Button type="submit" variant="primary" disabled={state === "submitting"} full>
        {state === "submitting" ? "Creating account…" : "Create account →"}
      </Button>

      <Reassure>
        🔒 Your details are kept private. Unsubscribe at any time.
      </Reassure>
      <Hint>
        Already have an account? <NextLink href="/sign-in">Sign in</NextLink>
      </Hint>
    </Panel>
  );
}
