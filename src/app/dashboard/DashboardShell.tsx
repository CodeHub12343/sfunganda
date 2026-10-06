"use client";

import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styled from "styled-components";
import { useCallback } from "react";
import { amMedia } from "@/components/admin-mobile/tokens";
import { ToastProvider } from "@/components/ui/Toast";
import { api } from "@/lib/api";

type Me = {
  user: { id: string; email: string; display_name: string } | null;
};

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/follows", label: "Following" },
  { href: "/dashboard/donations", label: "Donations" },
  { href: "/dashboard/notifications", label: "Notifications" },
  { href: "/dashboard/preferences", label: "Preferences" },
  { href: "/dashboard/account", label: "Account" },
];

const Wrap = styled.div`
  max-width: 1180px;
  margin: 0 auto;
  padding: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
  width: 100%;
  overflow-x: clip;

  ${amMedia.md} {
    padding: 2rem 1.5rem 4rem;
    grid-template-columns: 240px minmax(0, 1fr);
    gap: 2.25rem;
    overflow-x: visible;
  }
`;

/* ---------------- Mobile top-nav (replaces hamburger) ---------------- */

const MobileNav = styled.nav`
  position: sticky;
  top: 0;
  z-index: 10;
  padding: 0.6rem 0.9rem 0.7rem;
  background: ${({ theme }) => theme.gradients.trust};
  color: #fff;
  box-shadow: 0 6px 18px rgba(8, 23, 53, 0.14);
  width: 100%;
  box-sizing: border-box;

  ${amMedia.md} {
    display: none;
  }
`;

const MobileNavTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.55rem;
  min-width: 0;

  h2 {
    font-family: ${({ theme }) => theme.font.heading};
    font-size: 0.95rem;
    margin: 0;
    color: #fff;
    font-weight: 700;
    letter-spacing: 0.01em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    flex: 1;
  }
`;

const MobileSignOut = styled.button`
  appearance: none;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 999px;
  padding: 0.3rem 0.65rem;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  flex: 0 0 auto;
  white-space: nowrap;

  &:hover,
  &:focus-visible {
    background: rgba(255, 255, 255, 0.2);
  }
`;

const TabRow = styled.div`
  display: flex;
  gap: 0.4rem;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding-bottom: 0.2rem;

  &::-webkit-scrollbar {
    display: none;
  }
`;

const Tab = styled(NextLink)<{ $active: boolean }>`
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 0.95rem;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  transition: background 180ms ease, color 180ms ease, box-shadow 180ms ease;

  background: ${({ $active }) =>
    $active
      ? "linear-gradient(135deg, #F7B733 0%, #F28C28 100%)"
      : "rgba(255, 255, 255, 0.08)"};
  color: ${({ $active }) => ($active ? "#1a0f00" : "rgba(255,255,255,0.9)")};
  border: 1px solid
    ${({ $active }) => ($active ? "transparent" : "rgba(255, 255, 255, 0.18)")};
  box-shadow: ${({ $active }) =>
    $active ? "0 6px 18px rgba(242, 140, 40, 0.35)" : "none"};

  &:hover,
  &:focus-visible {
    background: ${({ $active }) =>
      $active
        ? "linear-gradient(135deg, #F7B733 0%, #F28C28 100%)"
        : "rgba(255, 255, 255, 0.16)"};
    color: ${({ $active }) => ($active ? "#1a0f00" : "#fff")};
  }
`;

/* ---------------- Desktop sidebar ---------------- */

const Aside = styled.aside`
  display: none;

  ${amMedia.md} {
    display: block;
    background: #fff;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.radius.md};
    padding: 1rem;
    box-shadow: ${({ theme }) => theme.shadow.ring};
    height: fit-content;
    position: sticky;
    top: 1.5rem;
  }
`;

const AsideHeader = styled.div`
  padding: 0.4rem 0.6rem 0.9rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  margin-bottom: 0.75rem;

  h2 {
    font-family: ${({ theme }) => theme.font.heading};
    font-size: 1.05rem;
    color: ${({ theme }) => theme.colors.trustBlue};
    margin: 0;
    font-weight: 700;
  }

  small {
    display: block;
    margin-top: 0.2rem;
    color: ${({ theme }) => theme.colors.inkMuted};
    font-size: 0.78rem;
  }
`;

const NavList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.2rem;
`;

const NavLink = styled(NextLink)<{ $active: boolean }>`
  display: flex;
  align-items: center;
  padding: 0.6rem 0.85rem;
  border-radius: 10px;
  color: ${({ theme, $active }) =>
    $active ? theme.colors.trustBlue : theme.colors.inkSoft};
  text-decoration: none;
  font-size: 0.93rem;
  font-weight: ${({ $active }) => ($active ? 600 : 500)};
  background: ${({ $active }) => ($active ? "rgba(16, 61, 122, 0.07)" : "transparent")};
  position: relative;

  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 25%;
    bottom: 25%;
    width: 3px;
    border-radius: 3px;
    background: ${({ theme, $active }) =>
      $active ? theme.gradients.sunrise : "transparent"};
  }

  &:hover,
  &:focus-visible {
    background: rgba(16, 61, 122, 0.07);
    color: ${({ theme }) => theme.colors.trustBlue};
  }
`;

const MainCol = styled.main`
  min-width: 0;
  padding: 0.9rem 0.9rem 2rem;
  box-sizing: border-box;
  width: 100%;

  ${amMedia.md} {
    padding: 0;
  }
`;

const SignOutButton = styled.button`
  margin-top: 0.75rem;
  width: 100%;
  display: block;
  padding: 0.6rem 0.85rem;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: #fff;
  color: #991b1b;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  text-align: left;

  &:hover,
  &:focus-visible {
    background: #fef2f2;
    border-color: #fecaca;
  }
`;

export function DashboardShell({ me, children }: { me: Me; children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  const signOut = useCallback(async () => {
    try {
      await api("/auth/sign-out", { json: {} });
    } finally {
      router.replace("/sign-in");
    }
  }, [router]);

  return (
    <ToastProvider>
      <Wrap>
        <MobileNav aria-label="Dashboard sections">
          <MobileNavTop>
            <h2>{me.user?.display_name ?? "Dashboard"}</h2>
            <MobileSignOut type="button" onClick={signOut}>
              Sign out
            </MobileSignOut>
          </MobileNavTop>
          <TabRow role="tablist">
            {NAV.map((n) => (
              <Tab key={n.href} href={n.href} $active={isActive(n.href)} role="tab">
                {n.label}
              </Tab>
            ))}
          </TabRow>
        </MobileNav>

        <Aside aria-label="Dashboard">
          <AsideHeader>
            <h2>{me.user?.display_name ?? "Dashboard"}</h2>
            <small>Supporter area</small>
          </AsideHeader>
          <nav aria-label="Dashboard">
            <NavList>
              {NAV.map((n) => (
                <li key={n.href}>
                  <NavLink href={n.href} $active={isActive(n.href)}>
                    {n.label}
                  </NavLink>
                </li>
              ))}
            </NavList>
          </nav>
          <SignOutButton type="button" onClick={signOut}>
            Sign out
          </SignOutButton>
        </Aside>

        <MainCol>{children}</MainCol>
      </Wrap>
    </ToastProvider>
  );
}
