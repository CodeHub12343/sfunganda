import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "./_shared.js";
import { requireTenant } from "@/middleware/tenant.js";

// =============================================================================
// Phase 13 — public branding payload. Reads the TENANT (resolved by host
// via middleware/tenant.ts), never the DB directly. The Next.js app
// consumes this at request time to render display name, tagline, hero
// copy, accent colour, and footer line.
//
// Everything served here is non-sensitive — it is literally the data
// the public pages display.
// =============================================================================

const router = Router();
router.use(rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const org = requireTenant(req);
    // Short cache: a branding change should reach visitors within a few
    // minutes without a redeploy.
    res.setHeader("cache-control", "public, max-age=120, s-maxage=300");
    res.json({
      data: {
        slug: org.slug,
        name: org.name,
        base_currency: org.base_currency,
        branding: org.branding,
      },
    });
  })
);

export default router;
