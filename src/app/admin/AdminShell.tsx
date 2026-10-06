"use client";

import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styled from "styled-components";
import { ToastProvider } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { flag } from "@/lib/flags";
import { AppShell } from "@/components/admin-mobile/AppShell";
import { NAV as MOBILE_NAV } from "@/components/admin-mobile/nav";

// Milestone 6 — launch cutover.
//
// The mobile-first `AppShell` is now the sole render path. The pre-launch
// `LegacyShell` has been deleted; the flag is kept only as a kill-switch:
// `am-flag-admin-mobileshell=off` cookie or `NEXT_PUBLIC_FLAG_ADMIN_MOBILESHELL=0`
// env var forces this component into a minimal server-rendered desktop fallback
// (see `KillSwitchShell` below). Full flag + fallback removal ships in the
// §7 cleanup PR of docs/admin-mobile-rollout.md.

type Me = {
  user: { id: string; email: string; display_name: string } | null;
  session: { mfa_verified: boolean };
  assignments: { role: string; scope_type: string; scope_id: string | null }[];
};

export function AdminShell({ me, children }: { me: Me; children: React.ReactNode }) {
  // Read via `flag(...)` (not `useFlag`) so the kill-switch doesn't re-render
  // the whole shell on cookie changes — the rollback is "set cookie, reload".
  const mobileShell = flag("admin.mobileShell");

  if (!mobileShell) {
    return (
      <ToastProvider>
        <KillSwitchShell me={me}>{children}</KillSwitchShell>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <AppShell me={me}>{children}</AppShell>
    </ToastProvider>
  );
}

/* --------------------------------------------------------------------------
 * Kill-switch fallback — minimal desktop shell for rollback use only.
 * Not a feature. Not styled for parity with the pre-launch admin. Shows a
 * banner so support can tell the user they're in rollback mode.
 * -------------------------------------------------------------------------- */

const Wrap = styled.div`
  min-height: 100vh;
  display: grid;
  grid-template-columns: 260px 1fr;
  background: ${({ theme }) => theme.colors.bgSoft};
`;

const Side = styled.aside`
  background: ${({ theme }) => theme.colors.bgDark};
  color: ${({ theme }) => theme.colors.onDark};
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  h1 {
    font-family: ${({ theme }) => theme.font.heading};
    font-size: 1.1rem;
    letter-spacing: -0.01em;
    margin: 0 0 0.5rem;
  }
  nav {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }
`;

const NavItem = styled(NextLink)<{ $active: boolean }>`
  display: block;
  padding: 0.6rem 0.85rem;
  border-radius: ${({ theme }) => theme.radius.md};
  color: ${({ theme }) => theme.colors.onDarkSoft};
  text-decoration: none;
  background: ${({ $active }) => ($active ? "rgba(255,255,255,0.08)" : "transparent")};
  &:hover,
  &:focus-visible {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }
`;

const Main = styled.main`
  padding: 2rem 2.25rem;
  max-width: 1200px;
`;

const Head = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
`;

const KillBanner = styled.div`
  background: #fff7ed;
  color: #9a3412;
  border: 1px solid #fdba74;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  margin-bottom: 1rem;
`;

const SignOut = styled.button`
  background: transparent;
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 0.5rem 0.9rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  cursor: pointer;
  font-size: 0.9rem;
  color: ${({ theme }) => theme.colors.ink};
  &:hover {
    background: #fff;
  }
`;

function KillSwitchShell({ me, children }: { me: Me; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const roles = me.assignments.map((a) => a.role);
  const visible = MOBILE_NAV.filter((n) => n.roles.some((r) => roles.includes(r)));

  async function signOut() {
    try {
      await api("/auth/sign-out", { json: {} });
    } finally {
      router.replace("/sign-in");
    }
  }

  return (
    <Wrap>
      <Side>
        <h1>Sarah&apos;s Foundation</h1>
        <nav aria-label="Admin">
          {visible.map((n) => (
            <NavItem key={n.href} href={n.href} $active={pathname === n.href}>
              {n.label}
            </NavItem>
          ))}
        </nav>
      </Side>
      <Main>
        <KillBanner role="status">
          You&apos;re seeing the admin kill-switch fallback. The mobile shell is
          temporarily disabled on your device or across the fleet. Clear the{" "}
          <code>am-flag-admin-mobileshell</code> cookie to restore the normal UI.
        </KillBanner>
        <Head>
          <div>
            <strong>{me.user?.display_name ?? "You"}</strong>
            <div style={{ fontSize: "0.82rem", color: "#6b7280" }}>
              {roles.length > 0 ? roles.join(", ") : "no roles"}
            </div>
          </div>
          <SignOut onClick={signOut}>Sign out</SignOut>
        </Head>
        {children}
      </Main>
    </Wrap>
  );
}
