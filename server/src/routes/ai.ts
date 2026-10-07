import { Router } from "express";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { z } from "zod";
import { asyncHandler, auth, parseBody } from "./_shared.js";
import {
  draftAccomplishment,
  listAiLogs,
  recordAcceptance,
} from "@/services/ai/draft.js";
import {
  draftEnglishSummary,
  setReviewedSummary,
} from "@/services/ai/videoSummary.js";
import { readCapUsage } from "@/services/ai/caps.js";
import { can } from "@/policy/index.js";
import { AppError } from "@/util/errors.js";
import { getProvider } from "@/services/ai/provider.js";

const router = Router();

// Per-IP burst limiter on top of the per-user daily cap — covers accidental
// client-side loops. The daily cap is the real control.
const draftLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get(
  "/status",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    if (!can(a.actor, "ai.draft")) throw new AppError("forbidden", "cannot use ai features");
    const provider = getProvider();
    const usage = await readCapUsage(
      new mongoose.Types.ObjectId(a.actor.organization_id),
      new mongoose.Types.ObjectId(a.actor.user_id)
    );
    res.json({
      data: {
        enabled: provider.enabled,
        provider: provider.name,
        model: provider.model,
        usage,
      },
    });
  })
);

const draftBody = z.object({
  accomplishment_id: z.string().min(1),
  seed_body: z.string().max(10_000).optional(),
});

router.post(
  "/draft/accomplishment",
  draftLimiter,
  asyncHandler(async (req, res) => {
    const a = auth(req);
    if (!can(a.actor, "ai.draft")) throw new AppError("forbidden", "cannot use ai drafting");
    const body = parseBody(draftBody, req.body);
    const result = await draftAccomplishment(a.actor, body);
    res.json({ data: result });
  })
);

const acceptBody = z.object({
  generation_id: z.string().min(1),
  accepted: z.boolean(),
  kept_fields: z.array(z.enum(["title", "body", "why_it_matters", "next_steps"])).optional(),
});

router.post(
  "/draft/acceptance",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    if (!can(a.actor, "ai.draft")) throw new AppError("forbidden", "cannot record ai acceptance");
    const body = parseBody(acceptBody, req.body);
    const r = await recordAcceptance(a.actor, body);
    res.json({ data: r });
  })
);

const videoSummaryBody = z.object({ media_asset_id: z.string().min(1) });

router.post(
  "/draft/video-summary",
  draftLimiter,
  asyncHandler(async (req, res) => {
    const a = auth(req);
    if (!can(a.actor, "ai.draft")) throw new AppError("forbidden", "cannot use ai drafting");
    const body = parseBody(videoSummaryBody, req.body);
    const r = await draftEnglishSummary(a.actor, body);
    res.json({ data: r });
  })
);

const setSummaryBody = z.object({
  media_asset_id: z.string().min(1),
  summary: z.string().max(2000),
});

router.put(
  "/video-summary",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(setSummaryBody, req.body);
    await setReviewedSummary(a.actor, body);
    res.json({ data: { ok: true } });
  })
);

// Founder-only log. The policy module blocks everyone else; the route
// nonetheless guards defensively.
router.get(
  "/logs",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    if (!can(a.actor, "ai.read_log")) throw new AppError("forbidden", "founder only");
    const data = await listAiLogs(a.actor, {
      limit: typeof req.query.limit === "string" ? Number(req.query.limit) : undefined,
      cursor: typeof req.query.cursor === "string" ? req.query.cursor : undefined,
    });
    res.json({ data });
  })
);

export default router;
