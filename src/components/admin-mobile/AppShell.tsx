"use client";

import styled from "styled-components";
import { useRouter, usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { AdminToastProvider } from "./Toast";
import { TopBar } from "./TopBar";
import { BottomTabBar } from "./BottomTabBar";
import { MoreDrawer } from "./MoreDrawer";
import { Sidebar } from "./Sidebar";
import { Sheet } from "./Sheet";
import { Button } from "./Button";
import { primaryTabs, titleFor, isActive } from "./nav";
import { amMedia } from "./tokens";
import { UploadsProvider, UploadsBanner } from "./UploadsProvider";

type Me = {
  user: { id: string; email: string; display_name: string } | null;
  session: { mfa_verified: boolean };
  assignments: { role: string; scope_type: string; scope_id: string | null }[];
};

type Props = {
  me: Me;
  children: React.ReactNode;
};

const Root = styled.div`
  min-height: 100dvh;
  background: var(--am-bg-soft);
  color: var(--am-ink);
  /* Contain any accidental mobile overflow (long tx memos, fixed-width
     SVGs, etc.) so the page never scrolls horizontally. */
  overflow-x: hidden;

  ${amMedia.lg} {
    display: grid;
    grid-template-columns: 260px 1fr;
    overflow-x: visible;
  }
`;

const SidebarSlot = styled.div`
  display: none;
  ${amMedia.lg} {
    display: block;
  }
`;

const MobileSlot = styled.div`
  display: contents;
  ${amMedia.lg} {
    display: none;
  }
`;

const Main = styled.main`
  padding: 16px;
  padding-bottom: calc(80px + env(safe-area-inset-bottom));
  /* Allow children in grid/flex layouts to shrink below their intrinsic
     width — without this, a long text/SVG child can push the main
     column wider than the viewport. */
  min-width: 0;

  ${amMedia.lg} {
    padding: 32px;
    padding-bottom: 32px;
    max-width: 1200px;
  }
`;

const ProfileRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 0 16px;
  border-bottom: 1px solid var(--am-border);
  margin-bottom: 16px;
`;

const ProfileName = styled.div`
  font-size: 18px;
  font-weight: 700;
  color: var(--am-ink);
`;

const ProfileEmail = styled.div`
  font-size: 13px;
  color: var(--am-ink-muted);
`;

const ProfileMeta = styled.div`
  font-size: 13px;
  color: var(--am-ink-muted);
`;

const ProfileActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0;
`;

export function AppShell({ me, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const roles = me.assignments.map((a) => a.role);
  const userName = me.user?.display_name ?? "You";
  const userEmail = me.user?.email ?? "";
  const roleSummary = roles.length > 0 ? roles.join(", ") : "no roles";

  const primary = primaryTabs(roles);
  const activeHref =
    [...primary]
      .reverse()
      .find((n) => isActive(pathname ?? "", n.href))?.href ?? null;
  const moreActive = !activeHref;

  const signOut = useCallback(async () => {
    try {
      await api("/auth/sign-out", { json: {} });
    } finally {
      router.replace("/sign-in");
    }
  }, [router]);

  const title = titleFor(pathname ?? "");

  return (
    <AdminToastProvider>
     <UploadsProvider>
      <Root>
        <SidebarSlot>
          <Sidebar
            pathname={pathname ?? ""}
            roles={roles}
            userName={userName}
            userRoles={roleSummary}
            onSignOut={signOut}
          />
        </SidebarSlot>

        <div>
          <MobileSlot>
            <TopBar
              title={title}
              userName={userName}
              onMenu={() => setDrawerOpen(true)}
              onProfile={() => setProfileOpen(true)}
            />
          </MobileSlot>

          <Main id="am-main" tabIndex={-1}>
            {children}
          </Main>

          <MobileSlot>
            <BottomTabBar
              tabs={primary}
              activeHref={activeHref}
              onMoreClick={() => setDrawerOpen(true)}
              moreActive={moreActive}
            />
          </MobileSlot>
        </div>

        <MoreDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          roles={roles}
          activeHref={pathname ?? null}
          primary={primary}
          userName={userName}
          userEmail={userEmail}
          onSignOut={signOut}
        />

        <Sheet
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          title="Profile"
        >
          <ProfileRow>
            <ProfileName>{userName}</ProfileName>
            {userEmail && <ProfileEmail>{userEmail}</ProfileEmail>}
            <ProfileMeta>Roles: {roleSummary}</ProfileMeta>
            <ProfileMeta>
              MFA: {me.session.mfa_verified ? "verified" : "not verified"}
            </ProfileMeta>
          </ProfileRow>
          <ProfileActions>
            <Button variant="danger" fullWidth onClick={signOut}>
              Sign out
            </Button>
          </ProfileActions>
        </Sheet>
        <UploadsBanner />
      </Root>
     </UploadsProvider>
    </AdminToastProvider>
  );
}
