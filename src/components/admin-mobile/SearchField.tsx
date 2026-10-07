"use client";

import styled from "styled-components";
import { forwardRef } from "react";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "ref"> & {
  onClear?: () => void;
};

const Wrap = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const Icon = styled.span`
  position: absolute;
  left: 12px;
  display: inline-flex;
  color: var(--am-ink-subtle);
  pointer-events: none;
`;

const Input = styled.input`
  width: 100%;
  min-height: 44px;
  padding: 0 40px 0 40px;
  border-radius: var(--am-radius-md);
  background: var(--am-surface);
  color: var(--am-ink);
  border: 1px solid var(--am-border-strong);
  font-family: inherit;
  font-size: 15px;
  line-height: 22px;
  -webkit-appearance: none;
  appearance: none;

  &::placeholder {
    color: var(--am-ink-subtle);
  }
  &:focus {
    outline: 2px solid var(--am-brand-500);
    outline-offset: 2px;
    border-color: var(--am-brand-500);
  }
`;

const Clear = styled.button`
  position: absolute;
  right: 6px;
  width: 32px;
  height: 32px;
  border-radius: var(--am-radius-pill);
  border: 0;
  background: transparent;
  color: var(--am-ink-muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  &:hover {
    background: var(--am-bg-soft);
  }
  &:focus-visible {
    outline: 2px solid var(--am-brand-500);
    outline-offset: 2px;
  }
`;

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.75" />
    <path d="m12 12 3 3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path
      d="M3 3l8 8M11 3l-8 8"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  </svg>
);

export const SearchField = forwardRef<HTMLInputElement, Props>(function SearchField(
  { onClear, value, placeholder = "Search", type = "search", ...rest },
  ref
) {
  const hasValue = typeof value === "string" ? value.length > 0 : false;
  return (
    <Wrap>
      <Icon>
        <SearchIcon />
      </Icon>
      <Input
        ref={ref}
        type={type}
        value={value}
        placeholder={placeholder}
        inputMode="search"
        autoComplete="off"
        spellCheck={false}
        {...rest}
      />
      {hasValue && onClear && (
        <Clear type="button" onClick={onClear} aria-label="Clear search">
          <XIcon />
        </Clear>
      )}
    </Wrap>
  );
});
