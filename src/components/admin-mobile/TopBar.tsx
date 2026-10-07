"use client";

import styled from "styled-components";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { IconButton } from "./IconButton";

type Props = {
  title: string;
  userName: string;
  unread?: number;
  onMenu: () => void;
  onProfile: () => void;
  onNotifications?: () => void;
};

const Bar = styled.header`
  position: sticky;
  top: 0;
  z-index: var(--am-z-sticky);
  display: flex;
  align-items: center;
  gap: 8px;
  height: 56px;
  padding: 0 8px 0 4px;
  padding-top: env(safe-area-inset-top);
  background: var(--am-surface);
  border-bottom: 1px solid var(--am-border);
  transition: box-shadow var(--am-dur-base) var(--am-ease-standard);

  &[data-scrolled="true"] {
    box-shadow: var(--am-shadow-1);
    border-bottom-color: transparent;
  }
`;

const Title = styled.h1`
  flex: 1 1 auto;
  margin: 0;
  min-width: 0;
  font-size: 17px;
  font-weight: 600;
  line-height: 24px;
  color: var(--am-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Trailing = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const BellWrap = styled.span`
  position: relative;
  display: inline-flex;
`;

const Dot = styled.span`
  position: absolute;
  top: 10px;
  right: 10px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: var(--am-radius-pill);
  background: var(--am-danger-600);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--am-surface);
`;

const AvatarBtn = styled.button`
  width: 44px;
  height: 44px;
  border: 0;
  background: transparent;
  padding: 6px;
  border-radius: var(--am-radius-pill);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  &:focus-visible {
    outline: 2px solid var(--am-brand-500);
    outline-offset: 2px;
  }
`;

const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <path
      d="M4 6h14M4 11h14M4 16h14"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  </svg>
);

const BellIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <path
      d="M5 9a6 6 0 0 1 12 0v4l1.5 2.5h-15L5 13z"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinejoin="round"
    />
    <path
      d="M9 17a2 2 0 0 0 4 0"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  </svg>
);

function useScrolled(): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 2);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return scrolled;
}

export function TopBar({
  title,
  userName,
  unread = 0,
  onMenu,
  onProfile,
  onNotifications,
}: Props) {
  const scrolled = useScrolled();
  const ref = useRef<HTMLElement>(null);
  return (
    <Bar ref={ref} data-scrolled={scrolled ? "true" : "false"}>
      <IconButton label="Open menu" onClick={onMenu} icon={<MenuIcon />} />
      <Title>{title}</Title>
      <Trailing>
        {onNotifications && (
          <BellWrap>
            <IconButton
              label={unread > 0 ? `${unread} notifications` : "Notifications"}
              onClick={onNotifications}
              icon={<BellIcon />}
            />
            {unread > 0 && <Dot aria-hidden="true">{unread > 9 ? "9+" : unread}</Dot>}
          </BellWrap>
        )}
        <AvatarBtn
          type="button"
          onClick={onProfile}
          aria-label={`Profile — ${userName}`}
        >
          <Avatar name={userName} size="sm" />
        </AvatarBtn>
      </Trailing>
    </Bar>
  );
}
