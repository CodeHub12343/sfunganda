"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
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
  width: min(460px, 100%);
  box-shadow: ${({ theme }) => theme.shadow.soft};
  h1 {
    font-family: ${({ theme }) => theme.font.heading};
    font-size: 1.6rem;
    color: ${({ theme }) => theme.colors.trustBlue};
    margin-bottom: 0.3rem;
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
  }
`;

type PageProps = { params: Promise<{ token: string }> };

export default function AcceptInvitePage({ params }: PageProps) {
  const { token } = use(params);
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password.length < 12) return setErr("Pick a password with at least 12 characters.");
    if (password !== confirm) return setErr("Passwords don't match.");
    setLoading(true);
    try {
      await api("/auth/invite/accept", { json: { token, password } });
      router.replace("/sign-in");
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Could not accept the invitation.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <Container>
        <Card>
          <h1>Set your password</h1>
          <p>Welcome to Sarah&apos;s Foundation. Choose a strong password to activate your account.</p>
          <form onSubmit={submit}>
            <Field>
              <span>New password</span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Field>
              <span>Confirm password</span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Field>
            {err ? <p role="alert" style={{ color: "#b91c1c", marginBottom: "0.75rem" }}>{err}</p> : null}
            <Button type="submit" loading={loading} full>
              {loading ? "Activating…" : "Activate account"}
            </Button>
          </form>
        </Card>
      </Container>
    </Shell>
  );
}
