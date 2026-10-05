"use client";

import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styled from "styled-components";
import { ToastProvider } from "@/components/ui/Toast";
import { api } from "@/lib/api";

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

type NavLink = { label: string; href: string; roles: string[] };

const NAV: NavLink[] = [
  { label: "Overview", href: "/admin", roles: ["founder", "director", "project_manager", "finance_manager", "media_manager"] },
  { label: "Users", href: "/admin/users", roles: ["founder", "director"] },
  { label: "Audit log", href: "/admin/audit", roles: ["founder", "director"] },
  {
    label: "Media library",
    href: "/admin/media",
    roles: ["founder", "director", "media_manager", "project_manager"],
  },
  {
    label: "Review queue",
    href: "/admin/queue",
    roles: ["founder", "director", "project_manager"],
  },
  {
    label: "Projects",
    href: "/admin/projects",
    roles: ["founder", "director", "project_manager"],
  },
];

type Me = {
  user: { id: string; email: string; display_name: string } | null;
  session: { mfa_verified: boolean };
  assignments: { role: string; scope_type: string; scope_id: string | null }[];
};

export function AdminShell({ me, children }: { me: Me; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const roles = me.assignments.map((a) => a.role);
  const visible = NAV.filter((n) => n.roles.some((r) => roles.includes(r)));

  async function signOut() {
    try {
      await api("/auth/sign-out", { json: {} });
    } finally {
      router.replace("/sign-in");
    }
  }

  return (
    <ToastProvider>
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
    </ToastProvider>
  );
}
