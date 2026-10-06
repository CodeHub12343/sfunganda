import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "./_shared.js";
import { publicPhotos } from "@/services/media.js";
import { Organization } from "@/models/index.js";
import { AppError } from "@/util/errors.js";
import { resolveAssetUrl } from "@/services/signedUrls.js";

const router = Router();

const limiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false });

router.get(
  "/",
  limiter,
  asyncHandler(async (req, res) => {
    const tenant = (req as unknown as { org?: { id: import("mongoose").Types.ObjectId } }).org;
    let orgId: import("mongoose").Types.ObjectId;
    if (tenant) {
      orgId = tenant.id;
    } else {
      const org = await Organization.findOne().sort({ _id: 1 }).lean();
      if (!org) throw new AppError("not_found", "no organization");
      orgId = org._id;
    }
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : null;
    const limitRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : NaN;
    const limit = Number.isFinite(limitRaw) ? limitRaw : undefined;
    const { items, next_cursor } = await publicPhotos(orgId.toString(), { cursor, limit });
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
          url,
          alt: a.alt_text ?? a.caption ?? a.original_filename,
          caption: a.caption,
          width: a.width,
          height: a.height,
          created_at: a.created_at,
        };
      })
    );
    res.setHeader("cache-control", "public, max-age=60, s-maxage=300");
    res.json({ data, next_cursor });
  })
);

export default router;
