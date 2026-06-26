"use client";

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

const StyledButton = styled(motion.a)<{ $variant: Variant; $full?: boolean }>`
  ${base}
  ${({ $variant }) => variants[$variant]}
  ${({ $full }) =>
    $full &&
    css`
      width: 100%;
    `}
`;

type ButtonProps = {
  children: React.ReactNode;
  href?: string;
  variant?: Variant;
  full?: boolean;
  onClick?: () => void;
} & React.ComponentProps<typeof motion.a>;

export function Button({
  children,
  href = "#",
  variant = "primary",
  full,
  ...rest
}: ButtonProps) {
  return (
    <StyledButton
      href={href}
      $variant={variant}
      $full={full}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97, y: -1 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      {...rest}
    >
      {children}
    </StyledButton>
  );
}
