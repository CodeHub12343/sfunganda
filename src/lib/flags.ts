// Feature flags. Thin wrapper so we can swap for LaunchDarkly/GrowthBook later
// without touching call sites. Defaults are the SOURCE OF TRUTH; env vars and
// cookies override at runtime.
//
// Env vars (set in Vercel / `.env.local`):
//   NEXT_PUBLIC_FLAG_<KEY>=1   — force on
//   NEXT_PUBLIC_FLAG_<KEY>=0   — force off
//
// Cookie override (QA / internal review):
//   am-flag-<key>=on | off
//
// Keys are kebab-case under a dot namespace, e.g. "admin.mobileShell".

export type FlagKey = "admin.mobileShell";

const DEFAULTS: Record<FlagKey, boolean> = {
  "admin.mobileShell": true,
};

function envKey(key: FlagKey): string {
  return `NEXT_PUBLIC_FLAG_${key.toUpperCase().replace(/[.-]/g, "_")}`;
}

function cookieKey(key: FlagKey): string {
  return `am-flag-${key.toLowerCase().replace(/\./g, "-")}`;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[.$?*|{}()[\]\\/+^]/g, "\\$&")}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw == null) return null;
  const v = raw.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  return null;
}

/**
 * Resolve a feature flag. Priority: cookie > env var > default.
 * Safe to call in both server and client components.
 */
export function flag(key: FlagKey): boolean {
  const cookie = parseFlag(readCookie(cookieKey(key)));
  if (cookie !== null) return cookie;

  const env = parseFlag(process.env[envKey(key)]);
  if (env !== null) return env;

  return DEFAULTS[key];
}

/**
 * React hook variant — identical result today, but exists so a future
 * provider-based flag system (LaunchDarkly etc.) can be wired without
 * touching call sites.
 */
export function useFlag(key: FlagKey): boolean {
  return flag(key);
}
