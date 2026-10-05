"use client";

import styled from "styled-components";

const Box = styled.div`
  padding: 2.5rem 1.5rem;
  border-radius: ${({ theme }) => theme.radius.md};
  border: 1px dashed ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bgSoft};
  color: ${({ theme }) => theme.colors.inkMuted};
  text-align: center;
  display: grid;
  gap: 0.4rem;
  h3 {
    color: ${({ theme }) => theme.colors.trustBlue};
    font-family: ${({ theme }) => theme.font.heading};
    font-size: 1.1rem;
    margin: 0;
  }
`;

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <Box>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action}
    </Box>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return <Box aria-busy="true">{label}</Box>;
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <Box role="alert">
      <h3>Something went wrong</h3>
      <p>{message}</p>
      {retry ? <button onClick={retry}>Try again</button> : null}
    </Box>
  );
}
