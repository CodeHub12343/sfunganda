import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "./_shared.js";
import { publicVideos } from "@/services/media.js";
import { Organization } from "@/models/index.js";
import { AppError } from "@/util/errors.js";
import { resolveAssetUrl } from "@/services/signedUrls.js";

const router = Router();

const limiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false });

router.get(
  "/",
  limiter,
  asyncHandler(async (_req, res) => {
    // Public feed — scope to the single primary organization. Multi-org
    // support goes through a slug once Phase 1's slug surface is wired to
    // the public site.
    const org = await Organization.findOne().sort({ _id: 1 }).lean();
    if (!org) throw new AppError("not_found", "no organization");
    const items = await publicVideos(org._id.toString());
    const data = await Promise.all(
      items.map(async (a) => {
        let url: string | null = null;
        try {
          const resolved = await resolveAssetUrl(a);
          url = resolved.url;
        } catch {
          url = null;
        }
        return {
          id: a._id.toString(),
          title: a.caption ?? a.alt_text ?? a.original_filename,
          duration_seconds: a.duration_seconds,
          width: a.width,
          height: a.height,
          hls_url: url,
          created_at: a.created_at,
        };
      })
    );
    res.setHeader("cache-control", "public, max-age=60, s-maxage=300");
    res.json({ data });
  })
);

export default router;
