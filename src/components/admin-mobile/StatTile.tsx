"use client";

import styled from "styled-components";
import { Card } from "./Card";
import { TrendLine } from "./TrendLine";

type Props = {
  label: string;
  value: string | number;
  delta?: { value: string; direction: "up" | "down" | "flat" };
  trend?: number[];
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
};

const Root = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  min-height: 112px;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--am-ink-muted);
`;

const Label = styled.span`
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;

const Value = styled.div`
  font-size: 24px;
  font-weight: 700;
  line-height: 32px;
  color: var(--am-ink);
  font-variant-numeric: tabular-nums;
`;

const Delta = styled.div<{ $dir: "up" | "down" | "flat" }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: ${({ $dir }) =>
    $dir === "up"
      ? "var(--am-success-600)"
      : $dir === "down"
        ? "var(--am-danger-600)"
        : "var(--am-ink-subtle)"};
`;

const Trend = styled.div`
  margin-top: auto;
`;

const Arrow = ({ dir }: { dir: "up" | "down" | "flat" }) => {
  if (dir === "flat")
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path d="M1 5h8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  const d = dir === "up" ? "M5 2l4 4H1z" : "M5 8L1 4h8z";
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" fill="currentColor">
      <path d={d} />
    </svg>
  );
};

export function StatTile({ label, value, delta, trend, icon, onClick, className }: Props) {
  return (
    <Root
      variant="stat"
      interactive={Boolean(onClick)}
      onClick={onClick}
      className={className}
    >
      <Head>
        <Label>{label}</Label>
        {icon}
      </Head>
      <Value>{value}</Value>
      {delta && (
        <Delta $dir={delta.direction}>
          <Arrow dir={delta.direction} />
          <span>{delta.value}</span>
        </Delta>
      )}
      {trend && trend.length > 1 && (
        <Trend>
          <TrendLine values={trend} height={28} width={128} />
        </Trend>
      )}
    </Root>
  );
}
