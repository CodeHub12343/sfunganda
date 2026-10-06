import { headers } from "next/headers";
import { brand as fallbackBrand } from "@/data/content";

// =============================================================================
// Phase 13 — resolve organisation branding at render time.
//
// Server-side helper for the public pages. Reads the Host header the
// request arrived on (which the proxy preserves), asks the API's
// `/v1/public/branding` endpoint for that tenant's values, and merges
// with the hard-coded fallback in content.ts.
//
// If the API is unreachable (local dev with no API running, cold start)
// we fall back to content.ts so the site still renders. This mirrors
// how the Next.js config caches public data for 60 s.
// =============================================================================

export type Branding = {
  slug: string;
  name: string;
  display_name: string;
  tagline: string;
  hero_markdown: string;
  accent_color: string;
  footer_line: string;
};

const DEFAULT_BRANDING: Branding = {
  slug: "sfu",
  name: fallbackBrand.fullName,
  display_name: fallbackBrand.name,
  tagline: fallbackBrand.tagline,
  hero_markdown: fallbackBrand.mission,
  accent_color: "#2563eb",
  footer_line: "",
};

export async function getBranding(): Promise<Branding> {
  const origin = process.env.API_ORIGIN;
  if (!origin) return DEFAULT_BRANDING;
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 2000);
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    const res = await fetch(`${origin}/v1/public/branding`, {
      signal: ctl.signal,
      headers: {
        "x-forwarded-host": host,
        ...(process.env.INTERNAL_PROXY_SECRET
          ? { "x-internal-secret": process.env.INTERNAL_PROXY_SECRET }
          : {}),
      },
      // Short Next cache so a branding change propagates without a redeploy.
      next: { revalidate: 120, tags: ["branding"] },
    });
    if (!res.ok) return DEFAULT_BRANDING;
    const j = (await res.json()) as {
      data?: {
        slug: string;
        name: string;
        branding: {
          display_name: string;
          tagline: string;
          hero_markdown: string;
          accent_color: string;
          footer_line: string;
        };
      };
    };
    if (!j.data) return DEFAULT_BRANDING;
    return {
      slug: j.data.slug,
      name: j.data.name,
      display_name: j.data.branding.display_name || j.data.name,
      tagline: j.data.branding.tagline || DEFAULT_BRANDING.tagline,
      hero_markdown: j.data.branding.hero_markdown || DEFAULT_BRANDING.hero_markdown,
      accent_color: j.data.branding.accent_color || DEFAULT_BRANDING.accent_color,
      footer_line: j.data.branding.footer_line,
    };
  } catch {
    return DEFAULT_BRANDING;
  } finally {
    clearTimeout(to);
  }
}

export { DEFAULT_BRANDING };
