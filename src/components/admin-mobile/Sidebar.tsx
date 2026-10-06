"use client";

import NextLink from "next/link";
import styled from "styled-components";
import { Icon } from "./icons";
import { primaryTabs, secondaryGrouped, isActive } from "./nav";

type Props = {
  pathname: string;
  roles: string[];
  userName: string;
  userRoles: string;
  onSignOut: () => void;
};

const Rail = styled.aside`
  background: var(--am-bg-soft);
  color: var(--am-ink);
  display: flex;
  flex-direction: column;
  padding: 24px 16px 16px;
  gap: 20px;
  border-right: 1px solid var(--am-border);
  width: 260px;
  flex-shrink: 0;
  overflow-y: auto;
`;

const Brand = styled.h1`
  font-size: 15px;
  font-weight: 700;
  margin: 0 4px;
  color: var(--am-ink);
  letter-spacing: -0.01em;
`;

const Group = styled.div`
  display: flex;
  flex-direction: column;
`;

const GroupTitle = styled.h2`
  margin: 0 4px 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--am-ink-subtle);
`;

const Item = styled(NextLink)`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--am-radius-md);
  color: var(--am-ink-muted);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  min-height: 36px;

  &:hover {
    background: var(--am-surface);
    color: var(--am-ink);
  }
  &[data-active="true"] {
    background: var(--am-brand-50);
    color: var(--am-brand-600);
    font-weight: 600;
  }
  &:focus-visible {
    outline: 2px solid var(--am-brand-500);
    outline-offset: 2px;
  }
`;

const Spacer = styled.div`
  flex: 1 1 auto;
`;

const UserCard = styled.div`
  padding: 10px 12px;
  background: var(--am-surface);
  border: 1px solid var(--am-border);
  border-radius: var(--am-radius-md);
`;

const UserName = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: var(--am-ink);
`;

const UserRoles = styled.div`
  font-size: 11px;
  color: var(--am-ink-muted);
  margin-top: 2px;
`;

const SignOutBtn = styled.button`
  margin-top: 8px;
  width: 100%;
  min-height: 36px;
  background: transparent;
  color: var(--am-ink-muted);
  border: 1px solid var(--am-border-strong);
  border-radius: var(--am-radius-pill);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  &:hover {
    background: var(--am-bg-soft);
    color: var(--am-ink);
  }
  &:focus-visible {
    outline: 2px solid var(--am-brand-500);
    outline-offset: 2px;
  }
`;

export function Sidebar({ pathname, roles, userName, userRoles, onSignOut }: Props) {
  const primary = primaryTabs(roles);
  const groups = secondaryGrouped(roles);

  return (
    <Rail>
      <Brand>Sarah&apos;s Foundation</Brand>

      <Group>
        <GroupTitle>Workspace</GroupTitle>
        {primary.map((n) => (
          <Item
            key={n.href}
            href={n.href}
            data-active={isActive(pathname, n.href) || undefined}
            aria-current={isActive(pathname, n.href) ? "page" : undefined}
          >
            <Icon name={n.icon} size={18} />
            <span>{n.label}</span>
          </Item>
        ))}
      </Group>

      {groups.map((g) => (
        <Group key={g.group}>
          <GroupTitle>{g.title}</GroupTitle>
          {g.items.map((n) => (
            <Item
              key={n.href}
              href={n.href}
              data-active={isActive(pathname, n.href) || undefined}
              aria-current={isActive(pathname, n.href) ? "page" : undefined}
            >
              <Icon name={n.icon} size={18} />
              <span>{n.label}</span>
            </Item>
          ))}
        </Group>
      ))}

      <Spacer />

      <UserCard>
        <UserName>{userName}</UserName>
        <UserRoles>{userRoles}</UserRoles>
        <SignOutBtn type="button" onClick={onSignOut}>
          Sign out
        </SignOutBtn>
      </UserCard>
    </Rail>
  );
}
