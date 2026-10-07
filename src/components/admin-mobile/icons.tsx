// Inline SVG icons used by the nav shell. Kept small and self-contained so we
// don't take a runtime dependency on Lucide/Phosphor just for the shell.

import type { NavIcon } from "./nav";

type Props = { name: NavIcon; size?: number; className?: string };

const paths: Record<NavIcon, React.ReactNode> = {
  home: (
    <>
      <path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3 20c0-3 2.8-5.5 6-5.5s6 2.5 6 5.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15 15c2.5 0 5 1.8 5 4" />
    </>
  ),
  activity: (
    <>
      <path d="M3 12h3.5l2.5-7 5 14 2.5-7H21" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="m3 17 5-5 5 5 3-3 5 5" />
    </>
  ),
  "check-square": (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="m8 12 3 3 5-7" />
    </>
  ),
  folder: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </>
  ),
  wallet: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h12l2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M17 12h3" />
      <circle cx="17.5" cy="12" r="0.75" fill="currentColor" stroke="none" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M3 13h18" />
    </>
  ),
  tool: (
    <>
      <path d="M14 7a4 4 0 1 1 3 7l-7 7-3-3 7-7a4 4 0 0 1 0-4z" />
    </>
  ),
  "file-text": (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
      <path d="M8 13h8M8 17h6" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />
    </>
  ),
  share: (
    <>
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="18" cy="18" r="3" />
      <path d="m8.5 10.5 7-3M8.5 13.5l7 3" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" />
    </>
  ),
  more: (
    <>
      <circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
};

export function Icon({ name, size = 24, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}
