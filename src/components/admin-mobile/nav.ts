// Single source of truth for admin navigation.
//
// Consumed by both the mobile shell (TopBar/BottomTabBar/MoreDrawer) and the
// desktop Sidebar. Role gating here must stay identical to the current
// AdminShell nav — adding routes or roles is an API-level change.

export type NavGroup = "primary" | "ops" | "people" | "programs" | "settings";

export type NavLink = {
  label: string;
  href: string;
  roles: string[];
  group: NavGroup;
  /** Primary-tab slot order on mobile. Lower = further left. */
  primaryOrder?: number;
  /** Lucide-style icon name — rendered inline so no runtime dep. */
  icon: NavIcon;
};

export type NavIcon =
  | "home"
  | "users"
  | "activity"
  | "image"
  | "check-square"
  | "folder"
  | "wallet"
  | "briefcase"
  | "tool"
  | "file-text"
  | "shield"
  | "share"
  | "building"
  | "more";

export const NAV: NavLink[] = [
  {
    label: "Overview",
    href: "/admin",
    roles: ["founder", "director", "project_manager", "finance_manager", "media_manager"],
    group: "primary",
    primaryOrder: 0,
    icon: "home",
  },
  {
    label: "Projects",
    href: "/admin/projects",
    roles: ["founder", "director", "project_manager"],
    group: "primary",
    primaryOrder: 1,
    icon: "folder",
  },
  {
    label: "Finance",
    href: "/admin/finance",
    roles: ["founder", "director", "finance_manager"],
    group: "primary",
    primaryOrder: 2,
    icon: "wallet",
  },

  // Operations
  {
    label: "Review queue",
    href: "/admin/queue",
    roles: ["founder", "director", "project_manager"],
    group: "ops",
    icon: "check-square",
  },
  {
    label: "Accomplishments",
    href: "/admin/accomplishments",
    roles: ["founder", "director", "project_manager", "field_member"],
    group: "ops",
    icon: "file-text",
  },
  {
    label: "Media library",
    href: "/admin/media",
    roles: ["founder", "director", "media_manager", "project_manager"],
    group: "ops",
    icon: "image",
  },
  {
    label: "Production",
    href: "/admin/businesses/production",
    roles: ["founder", "director", "project_manager", "finance_manager", "field_member"],
    group: "ops",
    icon: "tool",
  },

  // People & records
  {
    label: "Users",
    href: "/admin/users",
    roles: ["founder", "director"],
    group: "people",
    icon: "users",
  },
  {
    label: "Audit log",
    href: "/admin/audit",
    roles: ["founder", "director"],
    group: "people",
    icon: "activity",
  },
  {
    label: "Businesses",
    href: "/admin/businesses",
    roles: ["founder", "director", "project_manager", "finance_manager"],
    group: "people",
    icon: "briefcase",
  },

  // Programs
  {
    label: "Children's fund",
    href: "/admin/beneficiaries",
    roles: ["founder", "safeguarding_lead"],
    group: "programs",
    icon: "shield",
  },
  {
    label: "Social",
    href: "/admin/social",
    roles: ["founder", "director", "media_manager", "project_manager"],
    group: "programs",
    icon: "share",
  },
  {
    label: "Reports",
    href: "/admin/reports",
    roles: ["founder", "director", "project_manager", "media_manager", "finance_manager"],
    group: "programs",
    icon: "file-text",
  },

  // Settings
  {
    label: "Organisation",
    href: "/admin/organization",
    roles: ["founder"],
    group: "settings",
    icon: "building",
  },
];

/** Filter the nav to items visible to the given set of roles. */
export function visibleNav(roles: string[]): NavLink[] {
  return NAV.filter((n) => n.roles.some((r) => roles.includes(r)));
}

/**
 * The up-to-three primary nav items for the bottom bar, in order.
 * If a role has fewer than three primary destinations available, the bar
 * collapses — the "More" tab is always appended by the caller.
 */
export function primaryTabs(roles: string[]): NavLink[] {
  return visibleNav(roles)
    .filter((n) => n.group === "primary")
    .sort((a, b) => (a.primaryOrder ?? 99) - (b.primaryOrder ?? 99))
    .slice(0, 3);
}

/** Group non-primary visible items for the More drawer and the desktop sidebar. */
export function secondaryGrouped(
  roles: string[]
): { group: NavGroup; title: string; items: NavLink[] }[] {
  const visible = visibleNav(roles);
  const labels: Record<Exclude<NavGroup, "primary">, string> = {
    ops: "Operations",
    people: "People & records",
    programs: "Programs",
    settings: "Settings",
  };
  const order: Exclude<NavGroup, "primary">[] = ["ops", "people", "programs", "settings"];
  return order
    .map((group) => ({
      group,
      title: labels[group],
      items: visible.filter((n) => n.group === group),
    }))
    .filter((g) => g.items.length > 0);
}

/** Best-match title for a route (used by the mobile TopBar). */
export function titleFor(pathname: string): string {
  const exact = NAV.find((n) => n.href === pathname);
  if (exact) return exact.label;
  const prefix = NAV.filter((n) => pathname.startsWith(`${n.href}/`)).sort(
    (a, b) => b.href.length - a.href.length
  )[0];
  return prefix?.label ?? "Admin";
}

export function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}
