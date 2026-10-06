"use client";

import styled from "styled-components";
import { useRef, useCallback } from "react";

export type SegmentOption<T extends string> = {
  value: T;
  label: React.ReactNode;
  count?: number;
};

type Props<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
  className?: string;
};

const Group = styled.div<{ $size: "sm" | "md" }>`
  display: inline-grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  background: var(--am-bg-soft);
  border: 1px solid var(--am-border);
  border-radius: var(--am-radius-md);
  padding: 2px;
  width: 100%;
  min-height: ${({ $size }) => ($size === "sm" ? 36 : 44)}px;
`;

const Seg = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 10px;
  border: 0;
  background: ${({ $active }) => ($active ? "var(--am-surface)" : "transparent")};
  color: ${({ $active }) => ($active ? "var(--am-ink)" : "var(--am-ink-muted)")};
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  border-radius: calc(var(--am-radius-md) - 2px);
  box-shadow: ${({ $active }) => ($active ? "var(--am-shadow-1)" : "none")};
  cursor: pointer;
  transition:
    background-color var(--am-dur-fast) var(--am-ease-standard),
    color var(--am-dur-fast) var(--am-ease-standard);

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
  background: ${({ $active }) => ($active ? "var(--am-brand-50)" : "var(--am-border)")};
  color: ${({ $active }) => ($active ? "var(--am-brand-600)" : "var(--am-ink-muted)")};
`;

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
  className,
}: Props<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKey = useCallback(
    (e: React.KeyboardEvent, idx: number) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const dir = e.key === "ArrowRight" ? 1 : -1;
        const next = (idx + dir + options.length) % options.length;
        refs.current[next]?.focus();
        onChange(options[next].value);
      } else if (e.key === "Home") {
        e.preventDefault();
        refs.current[0]?.focus();
        onChange(options[0].value);
      } else if (e.key === "End") {
        e.preventDefault();
        const last = options.length - 1;
        refs.current[last]?.focus();
        onChange(options[last].value);
      }
    },
    [onChange, options]
  );

  return (
    <Group role="radiogroup" aria-label={label} $size={size} className={className}>
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <Seg
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            $active={active}
          >
            <span>{o.label}</span>
            {typeof o.count === "number" && <Count $active={active}>{o.count}</Count>}
          </Seg>
        );
      })}
    </Group>
  );
}
