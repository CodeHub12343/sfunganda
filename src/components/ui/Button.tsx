"use client";

import NextLink from "next/link";
import styled, { css } from "styled-components";
import { motion } from "framer-motion";

type Variant = "primary" | "secondary" | "ghost" | "light";

const base = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.6em;
  font-family: ${({ theme }) => theme.font.body};
  font-weight: ${({ theme }) => theme.weight.semibold};
  font-size: ${({ theme }) => theme.type.small};
  letter-spacing: 0.01em;
  line-height: 1;
  padding: 1.05rem 1.9rem;
  min-height: 52px;
  border-radius: ${({ theme }) => theme.radius.pill};
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  position: relative;
  isolation: isolate;
  transition:
    transform 0.25s ${({ theme }) => theme.ease.spring},
    box-shadow 0.3s ${({ theme }) => theme.ease.out},
    background 0.3s ${({ theme }) => theme.ease.out},
    color 0.3s ${({ theme }) => theme.ease.out};
  &:focus-visible {
    outline: 3px solid ${({ theme }) => theme.colors.sunriseOrange};
    outline-offset: 3px;
  }
  &[aria-disabled="true"],
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    pointer-events: none;
  }
`;

const variants: Record<Variant, ReturnType<typeof css>> = {
  primary: css`
    color: #fff;
    background: ${({ theme }) => theme.gradients.sunrise};
    box-shadow: ${({ theme }) => theme.shadow.glow};
    &:hover {
      box-shadow: 0 18px 48px rgba(242, 140, 40, 0.45);
    }
  `,
  secondary: css`
    color: ${({ theme }) => theme.colors.trustBlue};
    background: #fff;
    box-shadow: ${({ theme }) => theme.shadow.soft};
    border: 1px solid ${({ theme }) => theme.colors.border};
    &:hover {
      box-shadow: ${({ theme }) => theme.shadow.lift};
    }
  `,
  ghost: css`
    color: ${({ theme }) => theme.colors.trustBlue};
    background: transparent;
    border: 1.5px solid ${({ theme }) => theme.colors.borderStrong};
    &:hover {
      background: ${({ theme }) => theme.colors.trustBlue};
      color: #fff;
      border-color: ${({ theme }) => theme.colors.trustBlue};
    }
  `,
  light: css`
    color: ${({ theme }) => theme.colors.trustBlue};
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.6);
    &:hover {
      background: #fff;
    }
  `,
};

const styleBlock = css<{ $variant: Variant; $full?: boolean }>`
  ${base}
  ${({ $variant }) => variants[$variant]}
  ${({ $full }) =>
    $full &&
    css`
      width: 100%;
    `}
`;

const StyledAnchor = styled(motion.a)<{ $variant: Variant; $full?: boolean }>`
  ${styleBlock}
`;
const StyledLink = styled(NextLink)<{ $variant: Variant; $full?: boolean }>`
  ${styleBlock}
`;
const StyledButton = styled(motion.button)<{ $variant: Variant; $full?: boolean }>`
  ${styleBlock}
  border: none;
  font: inherit;
`;

type CommonProps = {
  children: React.ReactNode;
  variant?: Variant;
  full?: boolean;
  loading?: boolean;
};

type AsLink = CommonProps & {
  href: string;
  onClick?: never;
  disabled?: never;
  type?: never;
  target?: string;
  rel?: string;
};

type AsButton = CommonProps & {
  href?: undefined;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
};

export type ButtonProps = AsLink | AsButton;

// Route-aware primitive (T6). An external or `mailto:` href renders as an
// anchor; an internal route uses `next/link` for client-side navigation; no
// href renders a real `<button>`. `loading` and `disabled` are honoured for
// each form.
export function Button(props: ButtonProps) {
  const { children, variant = "primary", full, loading, ...rest } = props;
  const motionProps = {
    whileHover: loading ? undefined : { y: -3 },
    whileTap: loading ? undefined : { scale: 0.97, y: -1 },
    transition: { type: "spring" as const, stiffness: 400, damping: 22 },
  };

  if ("href" in rest && rest.href !== undefined) {
    const { href, target, rel } = rest;
    const isExternal =
      /^(https?:|mailto:|tel:)/i.test(href) || href.startsWith("//");
    const isHash = href.startsWith("#");
    if (isExternal || isHash) {
      return (
        <StyledAnchor
          href={href}
          target={target}
          rel={rel ?? (isExternal && target === "_blank" ? "noopener noreferrer" : undefined)}
          aria-disabled={loading || undefined}
          $variant={variant}
          $full={full}
          {...motionProps}
        >
          {children}
        </StyledAnchor>
      );
    }
    return (
      <StyledLink
        href={href}
        aria-disabled={loading || undefined}
        $variant={variant}
        $full={full}
      >
        {children}
      </StyledLink>
    );
  }

  const { onClick, disabled, type = "button" } = rest as AsButton;
  return (
    <StyledButton
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      $variant={variant}
      $full={full}
      {...motionProps}
    >
      {children}
    </StyledButton>
  );
}
