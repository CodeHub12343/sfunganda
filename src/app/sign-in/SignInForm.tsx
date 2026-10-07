"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import NextLink from "next/link";
import styled from "styled-components";
import { api, ApiClientError } from "@/lib/api";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { media } from "@/styles/theme";

type Me = {
  user: { id: string } | null;
  session: { mfa_verified: boolean };
  assignments: { role: string }[];
};

function homeFor(me: Me): string {
  if (!me.user) return "";
  const roles = me.assignments.map((a) => a.role);
  const staff = roles.some((r) =>
    ["founder", "director", "project_manager", "finance_manager", "media_manager", "field_member"].includes(r)
  );
  if (staff && !me.session.mfa_verified) return "/mfa";
  if (staff) return "/admin";
  return "/dashboard";
}

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

export function SignInForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 3000);
    (async () => {
      try {
        const me = await api<Me>("/me", { signal: ctl.signal } as never);
        if (cancelled) return;
        const dest = homeFor(me);
        if (dest) router.replace(sp.get("next") ?? dest);
      } catch {
        // Not signed in — form stays usable.
      } finally {
        clearTimeout(to);
      }
    })();
    return () => {
      cancelled = true;
      ctl.abort();
      clearTimeout(to);
    };
  }, [router, sp]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setErr("Enter your email and password.");
      return;
    }
    setErr(null);
    setLoading(true);
    try {
      const { mfa_required } = await api<{ mfa_required: boolean }>("/auth/sign-in", {
        json: { email, password },
      });
      // Route by role: staff → /admin (or /mfa first), supporters → /dashboard.
      // Hardcoding /admin as the fallback bounced supporters to the homepage.
      let dest = sp.get("next");
      if (!dest) {
        try {
          const me = await api<Me>("/me");
          dest = homeFor(me) || "/dashboard";
        } catch {
          dest = "/dashboard";
        }
      }
      router.replace(mfa_required ? `/mfa?next=${encodeURIComponent(dest)}` : dest);
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Could not sign in.");
      setLoading(false);
    }
  }

  return (
    <Panel onSubmit={submit} noValidate>
      {err ? <FormError role="alert">{err}</FormError> : null}

      <Field label="Email" required>
        {(p) => (
          <Input
            {...p}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </Field>

      <Field label="Password" required>
        {(p) => (
          <Input
            {...p}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
      </Field>

      <Button type="submit" variant="primary" loading={loading} full>
        {loading ? "Signing in…" : "Sign in →"}
      </Button>

      <Reassure>🔒 Encrypted connection · session cookies only.</Reassure>
      <Hint>
        New here? <NextLink href="/supporters/signup">Create a supporter account</NextLink>
      </Hint>
    </Panel>
  );
}
