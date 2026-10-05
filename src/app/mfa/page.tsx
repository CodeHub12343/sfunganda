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
    margin-bottom: 0.4rem;
  }
  p {
    color: ${({ theme }) => theme.colors.inkMuted};
    margin-bottom: 1.25rem;
    font-size: 0.95rem;
  }
  input {
    padding: 0.75rem 1rem;
    border-radius: ${({ theme }) => theme.radius.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    font: inherit;
    width: 100%;
    margin-bottom: 1rem;
    letter-spacing: 0.4em;
    text-align: center;
    font-size: 1.1rem;
  }
`;

export default function MfaPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await api<{ ok: boolean }>("/auth/mfa/verify", { json: { token } });
      router.replace(sp.get("next") ?? "/admin");
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Invalid code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <Container>
        <Card>
          <h1>Enter your MFA code</h1>
          <p>Open your authenticator app and enter the six-digit code.</p>
          <form onSubmit={submit}>
            <input
              inputMode="numeric"
              pattern="\d{6,8}"
              autoComplete="one-time-code"
              required
              value={token}
              onChange={(e) => setToken(e.target.value.trim())}
              aria-label="Authentication code"
            />
            {err ? <p role="alert" style={{ color: "#b91c1c", marginBottom: "0.75rem" }}>{err}</p> : null}
            <Button type="submit" loading={loading} full>
              {loading ? "Verifying…" : "Continue"}
            </Button>
          </form>
        </Card>
      </Container>
    </Shell>
  );
}
