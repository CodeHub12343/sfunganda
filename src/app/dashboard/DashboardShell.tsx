"use client";

import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styled from "styled-components";
import { useCallback, useState } from "react";
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
  max-width: 1100px;
  margin: 0 auto;
  padding: 1rem 1rem 2.5rem;
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;

  ${amMedia.md} {
    padding: 2rem 1.25rem 4rem;
    grid-template-columns: 220px 1fr;
    gap: 2rem;
  }
`;

const MobileHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;

  ${amMedia.md} {
    display: none;
  }
`;

const MobileTitle = styled.h1`
  font-size: 1.05rem;
  margin: 0;
  color: #111827;
`;

const MenuButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.75rem;
  font-size: 0.9rem;
  background: #fff;
  color: #111827;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: #f9fafb;
  }
`;

const Aside = styled.aside<{ $open: boolean }>`
  display: ${({ $open }) => ($open ? "block" : "none")};
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 0.75rem;

  ${amMedia.md} {
    display: block;
    background: transparent;
    border: none;
    padding: 0;
  }

  h2 {
    font-size: 1rem;
    margin: 0 0 0.75rem;
    color: #111827;
    display: none;
  }

  ${amMedia.md} {
    h2 {
      display: block;
    }
  }
`;

const NavList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.25rem;
`;

const NavLink = styled(NextLink)<{ $active: boolean }>`
  display: block;
  padding: 0.6rem 0.85rem;
  border-radius: 8px;
  color: #111827;
  text-decoration: none;
  font-size: 0.95rem;
  background: ${({ $active }) => ($active ? "#f3f4f6" : "transparent")};
  font-weight: ${({ $active }) => ($active ? 600 : 400)};

  &:hover,
  &:focus-visible {
    background: #f3f4f6;
  }
`;

const MainCol = styled.main`
  min-width: 0;
`;

const SignOutButton = styled.button`
  margin-top: 0.5rem;
  width: 100%;
  display: block;
  padding: 0.6rem 0.85rem;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #991b1b;
  font-size: 0.9rem;
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
  const [open, setOpen] = useState(false);

  const activeLabel =
    [...NAV].reverse().find((n) =>
      n.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(n.href),
    )?.label ?? "Dashboard";

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
        <MobileHeader>
          <MobileTitle>{activeLabel}</MobileTitle>
          <MenuButton
            type="button"
            aria-expanded={open}
            aria-controls="dashboard-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Close" : "Menu"}
          </MenuButton>
        </MobileHeader>

        <Aside id="dashboard-nav" $open={open}>
          <h2>{me.user?.display_name ?? "Dashboard"}</h2>
          <nav aria-label="Dashboard">
            <NavList>
              {NAV.map((n) => {
                const active =
                  n.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(n.href);
                return (
                  <li key={n.href}>
                    <NavLink
                      href={n.href}
                      $active={active}
                      onClick={() => setOpen(false)}
                    >
                      {n.label}
                    </NavLink>
                  </li>
                );
              })}
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
