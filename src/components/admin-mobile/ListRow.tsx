"use client";

import styled from "styled-components";
import { forwardRef } from "react";

type Props = {
  leading?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  chevron?: boolean;
  priorityColor?: string;
  priorityLabel?: string;
  onClick?: () => void;
  href?: string;
  selected?: boolean;
  className?: string;
};

const Chevron = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none">
    <path
      d="m6 4 4 4-4 4"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Row = styled.div<{ $interactive: boolean; $selected: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  min-height: 64px;
  background: ${({ $selected }) => ($selected ? "var(--am-brand-50)" : "var(--am-surface)")};
  color: var(--am-ink);
  text-decoration: none;
  cursor: ${({ $interactive }) => ($interactive ? "pointer" : "default")};
  transition: background-color var(--am-dur-fast) var(--am-ease-standard);
  border: 0;
  width: 100%;
  text-align: left;
  font-family: inherit;
  font-size: inherit;

  &:hover {
    background: ${({ $interactive }) =>
      $interactive ? "var(--am-bg-soft)" : "var(--am-surface)"};
  }
  &:focus-visible {
    outline: 2px solid var(--am-brand-500);
    outline-offset: -2px;
  }
  & + & {
    border-top: 1px solid var(--am-border);
  }
`;

const Priority = styled.span<{ $color: string }>`
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 2px;
  background: ${({ $color }) => $color};
  border-radius: 0 2px 2px 0;
`;

const Leading = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 48px;
`;

const Body = styled.div`
  flex: 1 1 auto;
  min-width: 0;
`;

const Title = styled.div`
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
  color: var(--am-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Meta = styled.div`
  font-size: 13px;
  line-height: 20px;
  color: var(--am-ink-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Trailing = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--am-ink-subtle);
`;

export const ListRow = forwardRef<HTMLElement, Props>(function ListRow(
  {
    leading,
    title,
    meta,
    trailing,
    chevron = true,
    priorityColor,
    priorityLabel,
    onClick,
    href,
    selected = false,
    className,
  },
  ref
) {
  const interactive = Boolean(onClick || href);
  const commonProps = {
    $interactive: interactive,
    $selected: selected,
    className,
  };

  const inner = (
    <>
      {priorityColor && (
        <Priority
          $color={priorityColor}
          aria-label={priorityLabel ? `Priority: ${priorityLabel}` : undefined}
        />
      )}
      {leading && <Leading>{leading}</Leading>}
      <Body>
        <Title>{title}</Title>
        {meta && <Meta>{meta}</Meta>}
      </Body>
      {(trailing || (interactive && chevron)) && (
        <Trailing>
          {trailing}
          {interactive && chevron && <Chevron />}
        </Trailing>
      )}
    </>
  );

  if (href) {
    return (
      <Row
        as="a"
        href={href}
        ref={ref as React.Ref<HTMLAnchorElement>}
        {...commonProps}
      >
        {inner}
      </Row>
    );
  }
  if (onClick) {
    return (
      <Row
        as="button"
        type="button"
        onClick={onClick}
        ref={ref as React.Ref<HTMLButtonElement>}
        {...commonProps}
      >
        {inner}
      </Row>
    );
  }
  return (
    <Row ref={ref as React.Ref<HTMLDivElement>} {...commonProps}>
      {inner}
    </Row>
  );
});
