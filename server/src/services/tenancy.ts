import mongoose from "mongoose";
import { Organization, type OrganizationDoc } from "@/models/index.js";
import { AppError } from "@/util/errors.js";
import type { Actor } from "@/policy/index.js";
import { can } from "@/policy/index.js";
import { env } from "@/config/env.js";

// =============================================================================
// Phase 13 — host-based organisation resolution.
//
// The resolver takes a request host and returns the matching
// Organization. Match rules, in order:
//   1. Exact match on `domains[]` (lowercase, no port).
//   2. The `MULTI_TENANT_DEFAULT_SLUG` env, if set.
//   3. The single organisation on the deployment (back-compat for
//      pre-Phase-13 single-tenant installs).
//   4. 404 — the host is unknown.
//
// We cache the lookup for 60 seconds in memory to spare the DB on every
// request. On branding or domain change, operators either wait a minute
// or restart the process; the admin screen also exposes a cache-clear
// endpoint on `PATCH`.
// =============================================================================

type CacheEntry = { host: string; org: OrganizationDoc; expires_at: number };
const CACHE_TTL_MS = 60_000;
let cache: Map<string, CacheEntry> = new Map();

export function clearTenantCache(): void {
  cache = new Map();
}

function normalizeHost(host: string | undefined): string {
  if (!host) return "";
  const h = host.toLowerCase().trim();
  // Strip port.
  const i = h.indexOf(":");
  return (i >= 0 ? h.slice(0, i) : h);
}

export async function resolveOrgByHost(host: string | undefined): Promise<OrganizationDoc | null> {
  const h = normalizeHost(host);
  if (h) {
    const cached = cache.get(h);
    if (cached && cached.expires_at > Date.now()) return cached.org;
    const byDomain = await Organization.findOne({ domains: h }).lean<OrganizationDoc>();
    if (byDomain) {
      cache.set(h, { host: h, org: byDomain, expires_at: Date.now() + CACHE_TTL_MS });
      return byDomain;
    }
  }
  const defaultSlug = process.env.MULTI_TENANT_DEFAULT_SLUG;
  if (defaultSlug) {
    const byDefault = await Organization.findOne({ slug: defaultSlug }).lean<OrganizationDoc>();
    if (byDefault) return byDefault;
  }
  // Back-compat: if exactly one organisation exists, return it.
  const count = await Organization.countDocuments();
  if (count === 1) return Organization.findOne().lean<OrganizationDoc>();
  return null;
}

export async function requireOrgByHost(host: string | undefined): Promise<OrganizationDoc> {
  const org = await resolveOrgByHost(host);
  if (!org) throw new AppError("not_found", "no organization is configured for this host");
  return org;
}

// -----------------------------------------------------------------------------
// Admin — settings & branding.
// -----------------------------------------------------------------------------

export type BrandingPatch = Partial<{
  display_name: string;
  tagline: string;
  hero_markdown: string;
  accent_color: string;
  footer_line: string;
}>;

export async function readOwnOrg(actor: Actor): Promise<OrganizationDoc> {
  if (!can(actor, "admin.open")) throw new AppError("forbidden", "cannot read organisation");
  const org = await Organization.findById(new mongoose.Types.ObjectId(actor.organization_id)).lean<OrganizationDoc>();
  if (!org) throw new AppError("not_found", "organisation not found");
  return org;
}

export async function updateOrgBranding(actor: Actor, patch: BrandingPatch): Promise<OrganizationDoc> {
  if (!can(actor, "organization.manage")) throw new AppError("forbidden", "cannot edit organisation");
  const orgId = new mongoose.Types.ObjectId(actor.organization_id);
  const current = await Organization.findById(orgId);
  if (!current) throw new AppError("not_found", "organisation not found");
  if (patch.accent_color && !/^#[0-9a-fA-F]{6}$/.test(patch.accent_color)) {
    throw new AppError("bad_request", "accent_color must be #RRGGBB");
  }
  const next = {
    display_name: patch.display_name ?? current.branding.display_name,
    tagline: patch.tagline ?? current.branding.tagline,
    hero_markdown: patch.hero_markdown ?? current.branding.hero_markdown,
    accent_color: patch.accent_color ?? current.branding.accent_color,
    footer_line: patch.footer_line ?? current.branding.footer_line,
    logo_asset_id: current.branding.logo_asset_id,
  };
  current.branding = next;
  current.version += 1;
  await current.save();
  clearTenantCache();
  return current.toObject();
}

// Replace the domains list atomically. We refuse to assign a domain
// already owned by a different organisation — the index helps lookups
// but Mongo cannot enforce array-element uniqueness across documents,
// so we check inside a transaction.
export async function setDomains(actor: Actor, domains: string[]): Promise<OrganizationDoc> {
  if (!can(actor, "organization.manage")) throw new AppError("forbidden", "cannot edit organisation");
  const orgId = new mongoose.Types.ObjectId(actor.organization_id);
  const normalized = Array.from(
    new Set(
      domains
        .map((d) => normalizeHost(d))
        .filter(Boolean)
        .filter((d) => /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(d))
    )
  );
  if (normalized.length !== domains.length) {
    throw new AppError("bad_request", "one or more domains are invalid", {
      fields: { domains: "must be lower-case bare host names" },
    });
  }
  const session = await mongoose.startSession();
  try {
    const result = await session.withTransaction(async () => {
      const current = await Organization.findById(orgId).session(session);
      if (!current) throw new AppError("not_found", "organisation not found");
      if (normalized.length > 0) {
        const conflict = await Organization.findOne({
          _id: { $ne: orgId },
          domains: { $in: normalized },
        })
          .session(session)
          .lean();
        if (conflict) {
          throw new AppError(
            "conflict",
            `domain already owned by ${conflict.slug}`,
            { fields: { domains: "already in use" } }
          );
        }
      }
      current.domains = normalized;
      current.version += 1;
      await current.save({ session });
      return current.toObject();
    });
    clearTenantCache();
    if (!result) throw new AppError("internal_error", "transaction returned no result");
    return result;
  } finally {
    await session.endSession();
  }
}

export async function setInterOrgSettings(actor: Actor, patch: Partial<{
  send_enabled: boolean;
  receive_enabled: boolean;
  allowed_recipient_slugs: string[];
}>): Promise<OrganizationDoc> {
  if (!can(actor, "organization.manage")) throw new AppError("forbidden", "cannot edit organisation");
  const orgId = new mongoose.Types.ObjectId(actor.organization_id);
  const current = await Organization.findById(orgId);
  if (!current) throw new AppError("not_found", "organisation not found");
  current.inter_org = {
    send_enabled: patch.send_enabled ?? current.inter_org.send_enabled,
    receive_enabled: patch.receive_enabled ?? current.inter_org.receive_enabled,
    allowed_recipient_slugs:
      patch.allowed_recipient_slugs !== undefined
        ? patch.allowed_recipient_slugs.map((s) => s.toLowerCase()).filter(Boolean)
        : current.inter_org.allowed_recipient_slugs,
  };
  current.version += 1;
  await current.save();
  clearTenantCache();
  return current.toObject();
}

// Keep `env` referenced so the ESM-import rule doesn't drop it under
// aggressive tree-shaking — the admin branding endpoint relies on
// `env.PUBLIC_SITE_URL` as a fallback.
void env;
