"use client";

import styled, { css } from "styled-components";
import { forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "icon";
export type ButtonSize = "sm" | "md" | "lg";

type Props = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "ref"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  fullWidth?: boolean;
};

const Spinner = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
    style={{ animation: "am-spin 700ms linear infinite" }}
  >
    <style>{`@keyframes am-spin { to { transform: rotate(360deg); } }`}</style>
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
    <path
      d="M14 8a6 6 0 0 0-6-6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const sizes = {
  sm: css`
    min-height: 36px;
    padding: 0 12px;
    font-size: 13px;
    gap: 6px;
  `,
  md: css`
    min-height: 44px;
    padding: 0 16px;
    font-size: 15px;
    gap: 8px;
  `,
  lg: css`
    min-height: 52px;
    padding: 0 20px;
    font-size: 16px;
    gap: 10px;
  `,
};

const variants = {
  primary: css`
    background: var(--am-brand-600);
    color: var(--am-ink-on-brand);
    &:hover:not(:disabled) {
      filter: brightness(1.08);
    }
    &:active:not(:disabled) {
      filter: brightness(0.92);
      transform: scale(0.98);
    }
  `,
  secondary: css`
    background: var(--am-surface);
    color: var(--am-ink);
    border: 1px solid var(--am-border-strong);
    &:hover:not(:disabled) {
      background: var(--am-bg-soft);
    }
    &:active:not(:disabled) {
      transform: scale(0.98);
    }
  `,
  ghost: css`
    background: transparent;
    color: var(--am-brand-500);
    &:hover:not(:disabled) {
      background: var(--am-brand-50);
    }
    &:active:not(:disabled) {
      transform: scale(0.98);
    }
  `,
  danger: css`
    background: var(--am-danger-600);
    color: #fff;
    &:hover:not(:disabled) {
      filter: brightness(1.08);
    }
    &:active:not(:disabled) {
      transform: scale(0.98);
    }
  `,
  icon: css`
    background: transparent;
    color: var(--am-ink);
    width: 44px;
    min-width: 44px;
    padding: 0;
    &:hover:not(:disabled) {
      background: var(--am-bg-soft);
    }
    &:active:not(:disabled) {
      transform: scale(0.92);
    }
  `,
};

const Root = styled.button<{
  $variant: ButtonVariant;
  $size: ButtonSize;
  $fullWidth: boolean;
}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--am-radius-md);
  border: 0;
  cursor: pointer;
  font-family: inherit;
  font-weight: 600;
  line-height: 1;
  transition:
    background-color var(--am-dur-fast) var(--am-ease-standard),
    transform var(--am-dur-fast) var(--am-ease-standard),
    filter var(--am-dur-fast) var(--am-ease-standard);
  width: ${({ $fullWidth }) => ($fullWidth ? "100%" : "auto")};
  ${({ $size }) => sizes[$size]}
  ${({ $variant }) => variants[$variant]}

  &:focus-visible {
    outline: 2px solid var(--am-brand-500);
    outline-offset: 2px;
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    leading,
    trailing,
    fullWidth = false,
    children,
    disabled,
    type = "button",
    ...rest
  },
  ref
) {
  return (
    <Root
      ref={ref}
      $variant={variant}
      $size={size}
      $fullWidth={fullWidth}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      type={type}
      {...rest}
    >
      {loading ? <Spinner /> : leading}
      {variant !== "icon" && <span>{children}</span>}
      {variant === "icon" && children}
      {!loading && trailing}
    </Root>
  );
});
