"use client";

import NextLink from "next/link";
import styled from "styled-components";
import { Sheet } from "./Sheet";
import { Icon } from "./icons";
import { secondaryGrouped, type NavLink } from "./nav";

type Props = {
  open: boolean;
  onClose: () => void;
  roles: string[];
  activeHref: string | null;
  /** Pinned primary items shown at the top of the drawer for one-handed reach. */
  primary?: NavLink[];
  userName: string;
  userEmail: string;
  onSignOut: () => void;
};

const Pinned = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 8px;
  padding: 4px 0 16px;
  border-bottom: 1px solid var(--am-border);
`;

const PinnedLink = styled(NextLink)`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 8px;
  border-radius: var(--am-radius-lg);
  background: var(--am-bg-soft);
  color: var(--am-ink);
  text-decoration: none;
  font-size: 12px;
  font-weight: 600;
  text-align: center;
  min-height: 72px;

  &[data-active="true"] {
    background: var(--am-brand-50);
    color: var(--am-brand-600);
  }
  &:focus-visible {
    outline: 2px solid var(--am-brand-500);
    outline-offset: 2px;
  }
`;

const Group = styled.section`
  padding: 16px 0 8px;
  & + & {
    border-top: 1px solid var(--am-border);
  }
`;

const GroupTitle = styled.h3`
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--am-ink-subtle);
`;

const Items = styled.div`
  display: flex;
  flex-direction: column;
`;

const Item = styled(NextLink)`
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  padding: 10px 4px;
  color: var(--am-ink);
  text-decoration: none;
  border-radius: var(--am-radius-md);

  &[data-active="true"] {
    background: var(--am-brand-50);
    color: var(--am-brand-600);
  }
  &:hover {
    background: var(--am-bg-soft);
  }
  &:focus-visible {
    outline: 2px solid var(--am-brand-500);
    outline-offset: 2px;
  }
`;

const ItemLabel = styled.span`
  flex: 1 1 auto;
  font-size: 15px;
  font-weight: 500;
`;

const Chevron = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="m6 4 4 4-4 4"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 0;
  border-top: 1px solid var(--am-border);
`;

const UserBlock = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const UserName = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: var(--am-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const UserEmail = styled.div`
  font-size: 12px;
  color: var(--am-ink-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SignOutBtn = styled.button`
  flex-shrink: 0;
  min-height: 36px;
  padding: 0 14px;
  background: transparent;
  color: var(--am-danger-600);
  border: 1px solid var(--am-border-strong);
  border-radius: var(--am-radius-pill);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  &:hover {
    background: var(--am-danger-50);
    border-color: var(--am-danger-600);
  }
  &:focus-visible {
    outline: 2px solid var(--am-brand-500);
    outline-offset: 2px;
  }
`;

export function MoreDrawer({
  open,
  onClose,
  roles,
  activeHref,
  primary,
  userName,
  userEmail,
  onSignOut,
}: Props) {
  const groups = secondaryGrouped(roles);
  return (
    <Sheet open={open} onClose={onClose} variant="full" title="Menu">
      {primary && primary.length > 0 && (
        <Pinned>
          {primary.map((p) => (
            <PinnedLink
              key={p.href}
              href={p.href}
              data-active={p.href === activeHref || undefined}
              onClick={onClose}
            >
              <Icon name={p.icon} size={22} />
              <span>{p.label}</span>
            </PinnedLink>
          ))}
        </Pinned>
      )}

      {groups.map((g) => (
        <Group key={g.group}>
          <GroupTitle>{g.title}</GroupTitle>
          <Items>
            {g.items.map((n) => (
              <Item
                key={n.href}
                href={n.href}
                data-active={n.href === activeHref || undefined}
                onClick={onClose}
              >
                <Icon name={n.icon} size={20} />
                <ItemLabel>{n.label}</ItemLabel>
                <Chevron />
              </Item>
            ))}
          </Items>
        </Group>
      ))}

      <Footer>
        <UserBlock>
          <UserName>{userName}</UserName>
          <UserEmail>{userEmail}</UserEmail>
        </UserBlock>
        <SignOutBtn
          type="button"
          onClick={() => {
            onClose();
            onSignOut();
          }}
        >
          Sign out
        </SignOutBtn>
      </Footer>
    </Sheet>
  );
}
