"use client";

import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styled from "styled-components";
import { useCallback, useEffect, useState } from "react";
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

/* ---------------- Mobile top bar + slide-out sidebar ---------------- */

const MobileBar = styled.header`
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.65rem 0.9rem;
  background: ${({ theme }) => theme.gradients.trust};
  color: #fff;
  box-shadow: 0 6px 18px rgba(8, 23, 53, 0.14);
  width: 100%;
  box-sizing: border-box;

  ${amMedia.md} {
    display: none;
  }
`;

const MobileTitleGroup = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;

  small {
    font-size: 0.68rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.hopeGold};
    font-weight: 700;
    line-height: 1;
  }

  h2 {
    font-family: ${({ theme }) => theme.font.heading};
    font-size: 1rem;
    margin: 0.2rem 0 0;
    color: #fff;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const Burger = styled.button`
  appearance: none;
  display: inline-grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.22);
  color: #fff;
  cursor: pointer;
  flex: 0 0 auto;

  span,
  span::before,
  span::after {
    content: "";
    display: block;
    width: 18px;
    height: 2px;
    border-radius: 2px;
    background: #fff;
    position: relative;
  }
  span::before {
    position: absolute;
    top: -6px;
  }
  span::after {
    position: absolute;
    top: 6px;
  }

  &:hover,
  &:focus-visible {
    background: rgba(255, 255, 255, 0.18);
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.hopeGold};
    outline-offset: 2px;
  }
`;

const Backdrop = styled.div<{ $open: boolean }>`
  position: fixed;
  inset: 0;
  z-index: 90;
  background: rgba(7, 17, 29, 0.55);
  backdrop-filter: blur(2px);
  opacity: ${({ $open }) => ($open ? 1 : 0)};
  pointer-events: ${({ $open }) => ($open ? "auto" : "none")};
  transition: opacity 220ms ease;

  ${amMedia.md} {
    display: none;
  }
`;

const Sheet = styled.aside<{ $open: boolean }>`
  position: fixed;
  top: 0;
  bottom: 0;
  right: 0;
  width: min(320px, 86vw);
  z-index: 100;
  background: ${({ theme }) => theme.gradients.trust};
  color: #fff;
  padding: 1.25rem 1.1rem 1.5rem;
  box-shadow: -12px 0 36px rgba(8, 23, 53, 0.3);
  transform: translateX(${({ $open }) => ($open ? "0" : "100%")});
  transition: transform 260ms ${({ theme }) => theme.ease.out};
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overscroll-behavior: contain;

  ${amMedia.md} {
    display: none;
  }
`;

const SheetTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.14);

  h2 {
    font-family: ${({ theme }) => theme.font.heading};
    font-size: 1.1rem;
    margin: 0;
    color: #fff;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    flex: 1;
  }

  small {
    display: block;
    font-size: 0.68rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.hopeGold};
    font-weight: 700;
    margin-bottom: 0.2rem;
  }
`;

const Close = styled.button`
  appearance: none;
  display: inline-grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.22);
  color: #fff;
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  flex: 0 0 auto;

  &:hover,
  &:focus-visible {
    background: rgba(255, 255, 255, 0.18);
  }
`;

const SheetNav = styled.nav`
  display: grid;
  gap: 0.3rem;
  margin-top: 1rem;
`;

const SheetLink = styled(NextLink)<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 0.9rem;
  border-radius: 12px;
  font-size: 0.95rem;
  font-weight: 600;
  text-decoration: none;
  transition: background 160ms ease, color 160ms ease;

  background: ${({ $active }) =>
    $active
      ? "linear-gradient(135deg, #F7B733 0%, #F28C28 100%)"
      : "rgba(255, 255, 255, 0.06)"};
  color: ${({ $active }) => ($active ? "#1a0f00" : "#fff")};
  border: 1px solid
    ${({ $active }) => ($active ? "transparent" : "rgba(255, 255, 255, 0.1)")};

  &:hover,
  &:focus-visible {
    background: ${({ $active }) =>
      $active
        ? "linear-gradient(135deg, #F7B733 0%, #F28C28 100%)"
        : "rgba(255, 255, 255, 0.14)"};
  }
`;

const SheetSignOut = styled.button`
  margin-top: auto;
  padding-top: 1rem;
  appearance: none;
  background: none;
  border: none;
  cursor: pointer;
  color: #fff;
  text-align: left;
  font-size: 0.92rem;
  font-weight: 600;

  span {
    display: block;
    padding: 0.75rem 0.9rem;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.14);
  }

  &:hover span,
  &:focus-visible span {
    background: rgba(255, 255, 255, 0.14);
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
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  const activeLabel =
    [...NAV].reverse().find((n) => isActive(n.href))?.label ?? "Dashboard";

  const signOut = useCallback(async () => {
    try {
      await api("/auth/sign-out", { json: {} });
    } finally {
      router.replace("/sign-in");
    }
  }, [router]);

  // Close on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll + Escape to close.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <ToastProvider>
      <Wrap>
        <MobileBar>
          <MobileTitleGroup>
            <small>Your dashboard</small>
            <h2>{activeLabel}</h2>
          </MobileTitleGroup>
          <Burger
            type="button"
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="dashboard-sheet"
            onClick={() => setOpen(true)}
          >
            <span />
          </Burger>
        </MobileBar>

        <Backdrop $open={open} onClick={() => setOpen(false)} aria-hidden={!open} />

        <Sheet
          id="dashboard-sheet"
          $open={open}
          role="dialog"
          aria-modal="true"
          aria-label="Dashboard menu"
          aria-hidden={!open}
        >
          <SheetTop>
            <div style={{ minWidth: 0, flex: 1 }}>
              <small>Signed in</small>
              <h2>{me.user?.display_name ?? "Dashboard"}</h2>
            </div>
            <Close
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            >
              ✕
            </Close>
          </SheetTop>

          <SheetNav aria-label="Dashboard">
            {NAV.map((n) => (
              <SheetLink
                key={n.href}
                href={n.href}
                $active={isActive(n.href)}
                onClick={() => setOpen(false)}
                tabIndex={open ? 0 : -1}
              >
                {n.label}
              </SheetLink>
            ))}
          </SheetNav>

          <SheetSignOut
            type="button"
            onClick={signOut}
            tabIndex={open ? 0 : -1}
          >
            <span>Sign out</span>
          </SheetSignOut>
        </Sheet>

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
