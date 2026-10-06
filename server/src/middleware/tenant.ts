import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { resolveOrgByHost } from "@/services/tenancy.js";
import type { OrganizationDoc } from "@/models/Organization.js";

// =============================================================================
// Phase 13 — resolve the tenant from the Host header on every request.
//
// Mounted BEFORE routes. Public routes read `req.org`; routes that already
// know the organisation from the session (admin, authenticated calls)
// continue to trust `req.auth.actor.organization_id`.
//
// The middleware never fails the request if no org is found — single-
// tenant installs continue to work via the fallback in resolveOrgByHost.
// Public routes that absolutely need an org call `requireTenant()` and
// surface a 404.
// =============================================================================

export type TenantContext = {
  id: mongoose.Types.ObjectId;
  slug: string;
  name: string;
  base_currency: string;
  branding: OrganizationDoc["branding"];
  domains: string[];
};

export async function resolveTenant(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Prefer the X-Forwarded-Host sent by the Next.js rewrite layer; the
    // internal proxy strips the original Host in some setups.
    const host =
      (req.header("x-forwarded-host") ?? req.header("host") ?? "").toString();
    const org = await resolveOrgByHost(host);
    if (org) {
      (req as unknown as { org: TenantContext }).org = {
        id: org._id,
        slug: org.slug,
        name: org.name,
        base_currency: org.base_currency,
        branding: org.branding,
        domains: org.domains,
      };
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function getTenant(req: Request): TenantContext | null {
  return (req as unknown as { org?: TenantContext }).org ?? null;
}

export function requireTenant(req: Request): TenantContext {
  const t = getTenant(req);
  if (!t) {
    // Use the shared AppError via dynamic import to avoid a circular dep
    // against middleware boot order.
    const { AppError } = require("@/util/errors.js") as typeof import("@/util/errors.js");
    throw new AppError("not_found", "no organisation is configured for this host");
  }
  return t;
}
