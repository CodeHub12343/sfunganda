"use client";

import styled, { css } from "styled-components";
import { forwardRef } from "react";

export type CardVariant = "default" | "stat" | "media" | "action";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  interactive?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  as?: keyof React.JSX.IntrinsicElements;
};

const paddings = {
  none: "0",
  sm: "12px",
  md: "16px",
  lg: "24px",
};

const variants: Record<CardVariant, ReturnType<typeof css>> = {
  default: css`
    background: var(--am-surface);
    box-shadow: var(--am-shadow-1);
  `,
  stat: css`
    background: var(--am-surface);
    box-shadow: var(--am-shadow-1);
  `,
  media: css`
    background: var(--am-surface);
    box-shadow: var(--am-shadow-1);
    overflow: hidden;
  `,
  action: css`
    background: var(--am-brand-50);
    color: var(--am-brand-600);
    box-shadow: none;
    border: 1px dashed var(--am-brand-500);
  `,
};

const Root = styled.div<{
  $variant: CardVariant;
  $interactive: boolean;
  $padding: Props["padding"];
}>`
  position: relative;
  border-radius: var(--am-radius-lg);
  color: var(--am-ink);
  padding: ${({ $padding }) => paddings[$padding ?? "md"]};
  ${({ $variant }) => variants[$variant]}
  transition:
    transform var(--am-dur-fast) var(--am-ease-standard),
    box-shadow var(--am-dur-base) var(--am-ease-standard);

  ${({ $interactive }) =>
    $interactive &&
    css`
      cursor: pointer;
      &:hover {
        box-shadow: var(--am-shadow-2);
      }
      &:active {
        transform: scale(0.995);
      }
      &:focus-visible {
        outline: 2px solid var(--am-brand-500);
        outline-offset: 2px;
      }
    `}
`;

export const Card = forwardRef<HTMLDivElement, Props>(function Card(
  {
    variant = "default",
    interactive = false,
    padding = "md",
    children,
    as,
    ...rest
  },
  ref
) {
  return (
    <Root
      ref={ref}
      $variant={variant}
      $interactive={interactive}
      $padding={padding}
      tabIndex={interactive ? 0 : undefined}
      {...(as ? { as } : {})}
      {...rest}
    >
      {children}
    </Root>
  );
});
