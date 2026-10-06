"use client";

import NextLink from "next/link";
import styled from "styled-components";
import { Icon } from "./icons";
import type { NavLink } from "./nav";

type Props = {
  tabs: NavLink[];
  activeHref: string | null;
  onMoreClick: () => void;
  moreActive: boolean;
};

const Bar = styled.nav`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: var(--am-z-sticky);
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  background: var(--am-surface);
  border-top: 1px solid var(--am-border);
  padding-bottom: env(safe-area-inset-bottom);
`;

const linkStyles = `
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 8px 4px;
  min-height: 56px;
  color: var(--am-ink-muted);
  text-decoration: none;
  background: transparent;
  border: 0;
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  position: relative;
  cursor: pointer;

  &[data-active="true"] {
    color: var(--am-brand-600);
  }
  &[data-active="true"]::before {
    content: "";
    position: absolute;
    top: 0;
    left: 20%;
    right: 20%;
    height: 2px;
    background: var(--am-brand-600);
    border-radius: 0 0 2px 2px;
  }
  &:focus-visible {
    outline: 2px solid var(--am-brand-500);
    outline-offset: -2px;
  }
`;

const TabLink = styled(NextLink)`
  ${linkStyles}
`;

const TabBtn = styled.button`
  ${linkStyles}
`;

const Label = styled.span`
  line-height: 14px;
`;

export function BottomTabBar({ tabs, activeHref, onMoreClick, moreActive }: Props) {
  return (
    <Bar aria-label="Primary">
      {tabs.map((t) => (
        <TabLink
          key={t.href}
          href={t.href}
          data-active={t.href === activeHref || undefined}
          aria-current={t.href === activeHref ? "page" : undefined}
        >
          <Icon name={t.icon} size={22} />
          <Label>{t.label}</Label>
        </TabLink>
      ))}
      <TabBtn
        type="button"
        onClick={onMoreClick}
        data-active={moreActive || undefined}
        aria-haspopup="dialog"
        aria-expanded={moreActive}
      >
        <Icon name="more" size={22} />
        <Label>More</Label>
      </TabBtn>
    </Bar>
  );
}
