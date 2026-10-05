"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styled from "styled-components";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { api, ApiClientError } from "@/lib/api";

const Shell = styled.main`
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 4rem 1.25rem;
  background: ${({ theme }) => theme.colors.bgSoft};
`;

const Card = styled.div`
  background: #fff;
  border-radius: ${({ theme }) => theme.radius.lg};
  padding: 2rem;
  width: min(420px, 100%);
  box-shadow: ${({ theme }) => theme.shadow.soft};
  h1 {
    font-family: ${({ theme }) => theme.font.heading};
    font-size: 1.6rem;
    color: ${({ theme }) => theme.colors.trustBlue};
    margin-bottom: 0.5rem;
  }
  p {
    color: ${({ theme }) => theme.colors.inkMuted};
    margin-bottom: 1.25rem;
    font-size: 0.95rem;
  }
`;

const Field = styled.label`
  display: grid;
  gap: 0.3rem;
  margin-bottom: 1rem;
  span {
    font-size: 0.82rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.ink};
  }
  input {
    padding: 0.75rem 1rem;
    border-radius: ${({ theme }) => theme.radius.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    font: inherit;
    &:focus-visible {
      outline: 3px solid ${({ theme }) => theme.colors.sunriseOrange};
      outline-offset: 2px;
    }
  }
`;

const Err = styled.p`
  color: ${({ theme }) => theme.colors.attention};
  font-size: 0.9rem;
  margin: 0 0 1rem;
`;

export default function SignInPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const { mfa_required } = await api<{ mfa_required: boolean }>("/auth/sign-in", {
        json: { email, password },
      });
      const next = sp.get("next") ?? "/admin";
      router.replace(mfa_required ? `/mfa?next=${encodeURIComponent(next)}` : next);
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <Container>
        <Card>
          <h1>Sign in</h1>
          <p>Staff and partners access to Sarah&apos;s Foundation.</p>
          <form onSubmit={submit}>
            <Field>
              <span>Email</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field>
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {err ? <Err role="alert">{err}</Err> : null}
            <Button type="submit" loading={loading} full>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Card>
      </Container>
    </Shell>
  );
}
