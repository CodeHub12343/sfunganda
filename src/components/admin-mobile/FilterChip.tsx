"use client";

import styled from "styled-components";
import { forwardRef } from "react";

type Props = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "ref"> & {
  active?: boolean;
  count?: number;
  trailing?: React.ReactNode;
};

const Root = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 12px;
  border-radius: var(--am-radius-pill);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  background: ${({ $active }) => ($active ? "var(--am-brand-600)" : "var(--am-surface)")};
  color: ${({ $active }) => ($active ? "var(--am-ink-on-brand)" : "var(--am-ink)")};
  border: 1px solid
    ${({ $active }) => ($active ? "var(--am-brand-600)" : "var(--am-border-strong)")};
  transition: all var(--am-dur-fast) var(--am-ease-standard);

  &:hover:not(:disabled) {
    background: ${({ $active }) => ($active ? "var(--am-brand-500)" : "var(--am-bg-soft)")};
  }
  &:focus-visible {
    outline: 2px solid var(--am-brand-500);
    outline-offset: 2px;
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Count = styled.span<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: var(--am-radius-pill);
  font-size: 11px;
  background: ${({ $active }) => ($active ? "rgba(255,255,255,0.25)" : "var(--am-bg-soft)")};
  color: inherit;
`;

export const FilterChip = forwardRef<HTMLButtonElement, Props>(function FilterChip(
  { active = false, count, trailing, children, type = "button", ...rest },
  ref
) {
  return (
    <Root ref={ref} $active={active} aria-pressed={active} type={type} {...rest}>
      <span>{children}</span>
      {typeof count === "number" && <Count $active={active}>{count}</Count>}
      {trailing}
    </Root>
  );
});
