import { Router } from "express";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { asyncHandler } from "./_shared.js";
import { AppError } from "@/util/errors.js";
import { Organization } from "@/models/index.js";
import { getPublicTranslation } from "@/services/ai/videoSummary.js";

// =============================================================================
// Public endpoint for R-D — "Options to view video summary in any language".
// GET /v1/public/videos/:id/summary?lang=lg
//
// Returns the reviewed English summary verbatim for "en", or a cached
// machine translation for anything else. The response always carries the
// `machine_translated` flag so the UI can label it accordingly (§14.8).
// =============================================================================

const router = Router();

const limiter = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false });

// Allow-list of languages the UI picker exposes. Keeping it a short list
// avoids rogue translations into obscure codes that balloon costs. Operators
// adjust by changing this constant — intentionally not an env to stop a
// hot-config error from authorising thousands of calls.
export const SUPPORTED_LANGUAGES = ["en", "lg", "sw", "fr", "ar"] as const;

router.get(
  "/:id/summary",
  limiter,
  asyncHandler(async (req, res) => {
    const lang = typeof req.query.lang === "string" ? req.query.lang.toLowerCase() : "en";
    if (!(SUPPORTED_LANGUAGES as readonly string[]).includes(lang)) {
      throw new AppError("bad_request", "unsupported language");
    }
    const assetId = String(req.params.id ?? "");
    if (!mongoose.isValidObjectId(assetId)) {
      throw new AppError("bad_request", "invalid id");
    }
    const tenant = (req as unknown as { org?: { id: mongoose.Types.ObjectId } }).org;
    let orgId: mongoose.Types.ObjectId;
    if (tenant) {
      orgId = tenant.id;
    } else {
      const org = await Organization.findOne().sort({ _id: 1 }).lean();
      if (!org) throw new AppError("not_found", "no organization");
      orgId = org._id;
    }

    const r = await getPublicTranslation({
      organization_id: String(orgId),
      media_asset_id: assetId,
      language: lang,
    });
    if (!r) throw new AppError("not_found", "summary not available");

    // Translations are stable per content hash and cheap after the first
    // compute — cache aggressively, but keep short SMAX so a corrected
    // English summary propagates fast.
    res.setHeader("cache-control", "public, max-age=300, s-maxage=600");
    res.json({ data: r });
  })
);

export default router;
