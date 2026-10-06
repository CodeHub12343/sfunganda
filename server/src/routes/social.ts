import { Router } from "express";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { z } from "zod";
import { asyncHandler, auth, parseBody } from "./_shared.js";
import { can } from "@/policy/index.js";
import { AppError } from "@/util/errors.js";
import { env } from "@/config/env.js";
import {
  availablePlatforms,
  beginOAuth,
  completeOAuth,
  listConnections,
  revokeConnection,
  type Platform,
} from "@/services/social/connections.js";
import { retryPost } from "@/services/social/fanout.js";
import { SocialPost } from "@/models/index.js";

// =============================================================================
// Phase 12 routes. Mounted at `/v1/social` for the admin surface and the
// OAuth callback. Nothing here is public: the admin shell forwards
// authenticated calls; the OAuth callback also carries the session
// cookie (SameSite=Lax).
// =============================================================================

const router = Router();
const limiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false });

router.use(limiter);

router.get(
  "/platforms",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    if (!can(a.actor, "social.read")) throw new AppError("forbidden", "cannot read social");
    res.json({
      data: {
        enabled: Boolean(env.SOCIAL_ENABLED),
        platforms: availablePlatforms(),
      },
    });
  })
);

router.get(
  "/connections",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const data = await listConnections(a.actor);
    res.json({ data });
  })
);

const platformSchema = z.enum(["youtube", "facebook", "instagram", "tiktok"]);

router.post(
  "/connections/:platform/begin",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const platform = platformSchema.parse(req.params.platform);
    const r = beginOAuth(a.actor, platform);
    res.json({ data: r });
  })
);

// Callback — a redirect comes in from the provider with `code` and
// `state`. We complete the exchange and bounce to the admin page.
router.get(
  "/oauth/:platform/callback",
  asyncHandler(async (req, res) => {
    const platform = platformSchema.parse(req.params.platform) as Platform;
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    if (!code || !state) throw new AppError("bad_request", "missing code or state");
    const r = await completeOAuth({ platform, code, state });
    // Bounce back to the admin shell. We land them on the connections
    // page with a success flag so the UI can toast.
    const base = env.PUBLIC_SITE_URL.replace(/\/$/, "");
    res.redirect(302, `${base}/admin/social?connected=${encodeURIComponent(r.channel_name)}`);
  })
);

router.post(
  "/connections/:id/revoke",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const id = String(req.params.id ?? "");
    await revokeConnection(a.actor, id);
    res.json({ data: { ok: true } });
  })
);

const listQ = z.object({
  accomplishment_id: z.string().optional(),
  state: z.enum(["queued", "posting", "posted", "failed", "skipped"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

router.get(
  "/posts",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    if (!can(a.actor, "social.read")) throw new AppError("forbidden", "cannot read social");
    const q = parseBody(listQ, req.query);
    const filter: Record<string, unknown> = {
      organization_id: new mongoose.Types.ObjectId(a.actor.organization_id),
    };
    if (q.accomplishment_id) filter.accomplishment_id = new mongoose.Types.ObjectId(q.accomplishment_id);
    if (q.state) filter.state = q.state;
    const rows = await SocialPost.find(filter)
      .sort({ created_at: -1 })
      .limit(q.limit ?? 50)
      .lean();
    res.json({
      data: rows.map((r) => ({
        id: r._id.toString(),
        accomplishment_id: r.accomplishment_id.toString(),
        media_asset_id: r.media_asset_id.toString(),
        platform: r.platform,
        state: r.state,
        external_id: r.external_id,
        external_url: r.external_url,
        attempts: r.attempts,
        last_error: r.last_error,
        skip_reason: r.skip_reason,
        created_at: r.created_at,
      })),
    });
  })
);

router.post(
  "/posts/:id/retry",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    if (!can(a.actor, "social.retry")) throw new AppError("forbidden", "cannot retry");
    const id = String(req.params.id ?? "");
    if (!mongoose.isValidObjectId(id)) throw new AppError("bad_request", "invalid id");
    await retryPost({
      organization_id: new mongoose.Types.ObjectId(a.actor.organization_id),
      post_id: id,
      user_id: a.actor.user_id,
    });
    res.json({ data: { ok: true } });
  })
);

export default router;
