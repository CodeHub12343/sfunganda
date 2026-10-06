"use client";

import styled from "styled-components";

export type AvatarSize = "sm" | "md" | "lg";
export type AvatarStatus = "online" | "offline" | "busy" | "away" | null;

type Props = {
  name: string;
  src?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  className?: string;
};

const px = { sm: 32, md: 48, lg: 64 } as const;

const Wrap = styled.span<{ $size: AvatarSize }>`
  position: relative;
  display: inline-flex;
  width: ${({ $size }) => px[$size]}px;
  height: ${({ $size }) => px[$size]}px;
  flex-shrink: 0;
`;

const Face = styled.span<{ $size: AvatarSize; $tone: string }>`
  width: 100%;
  height: 100%;
  border-radius: var(--am-radius-pill);
  background: ${({ $tone }) => $tone};
  color: var(--am-ink-on-brand);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: ${({ $size }) => ($size === "sm" ? 12 : $size === "md" ? 16 : 22)}px;
  font-weight: 600;
  overflow: hidden;
  user-select: none;
`;

const Img = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const Dot = styled.span<{ $status: Exclude<AvatarStatus, null>; $size: AvatarSize }>`
  position: absolute;
  bottom: 0;
  right: 0;
  width: ${({ $size }) => ($size === "sm" ? 8 : $size === "md" ? 10 : 14)}px;
  height: ${({ $size }) => ($size === "sm" ? 8 : $size === "md" ? 10 : 14)}px;
  border-radius: var(--am-radius-pill);
  border: 2px solid var(--am-surface);
  background: ${({ $status }) =>
    $status === "online"
      ? "var(--am-success-600)"
      : $status === "busy"
        ? "var(--am-danger-600)"
        : $status === "away"
          ? "var(--am-warning-600)"
          : "var(--am-ink-subtle)"};
`;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const PALETTE = [
  "#4f46e5",
  "#0ea5e9",
  "#059669",
  "#d97706",
  "#dc2626",
  "#8b5cf6",
  "#db2777",
];

function tone(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function Avatar({ name, src, size = "md", status, className }: Props) {
  const label = `${name}${status ? `, ${status}` : ""}`;
  return (
    <Wrap $size={size} className={className} aria-label={label} role="img">
      <Face $size={size} $tone={tone(name)}>
        {src ? <Img src={src} alt="" /> : initials(name)}
      </Face>
      {status && <Dot $status={status} $size={size} aria-hidden="true" />}
    </Wrap>
  );
}
