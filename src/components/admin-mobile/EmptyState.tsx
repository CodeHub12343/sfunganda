"use client";

import styled from "styled-components";

type Props = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

const Root = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 48px 16px;
  color: var(--am-ink-muted);
  gap: 12px;
`;

const IconWrap = styled.div`
  width: 72px;
  height: 72px;
  border-radius: var(--am-radius-pill);
  background: var(--am-bg-soft);
  color: var(--am-brand-500);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--am-ink);
`;

const Desc = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  color: var(--am-ink-muted);
  max-width: 36ch;
`;

const Action = styled.div`
  margin-top: 8px;
`;

const DefaultIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="1.75" />
    <path
      d="M11 16h10M16 11v10"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeOpacity="0.5"
    />
  </svg>
);

export function EmptyState({ icon, title, description, action, className }: Props) {
  return (
    <Root className={className} role="status">
      <IconWrap>{icon ?? <DefaultIcon />}</IconWrap>
      <Title>{title}</Title>
      {description && <Desc>{description}</Desc>}
      {action && <Action>{action}</Action>}
    </Root>
  );
}
