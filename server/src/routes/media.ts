import { Router } from "express";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { asyncHandler, auth, parseBody } from "./_shared.js";
import {
  consentBody,
  mediaCompleteBody,
  mediaFlagBody,
  mediaTicketBody,
  mediaUpdateBody,
} from "@shared/schemas/media.js";
import {
  abortUpload,
  completeUpload,
  createTicket,
  flagAsset,
  listAssets,
  softDelete,
  updateAsset,
} from "@/services/media.js";
import { resolveAssetUrl } from "@/services/signedUrls.js";
import { recordConsent, revokeConsent } from "@/services/consent.js";
import { MediaAsset } from "@/models/index.js";
import { AppError } from "@/util/errors.js";
import { can } from "@/policy/index.js";

const router = Router();

// Ticketing is cheap but attracts abuse; 30/min/user is generous for a
// human and will shut down scripts fast.
const ticketLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as unknown as { auth?: { actor: { user_id: string } } }).auth?.actor.user_id ?? req.ip!,
});

router.post(
  "/tickets",
  ticketLimiter,
  asyncHandler(async (req, res) => {
    const body = parseBody(mediaTicketBody, req.body);
    const a = auth(req);
    const ticket = await createTicket({
      actor: a.actor,
      kind: body.kind,
      mime: body.mime,
      bytes: body.bytes,
      filename: body.filename,
      visibility: body.visibility,
      sha256: body.sha256,
      alt_text: body.alt_text,
      via_provider: body.via_provider,
      link: body.link ? { target: body.link.target, id: body.link.id, role: body.link.role } : undefined,
    });
    res.json({ data: ticket });
  })
);

router.post(
  "/complete",
  asyncHandler(async (req, res) => {
    const body = parseBody(mediaCompleteBody, req.body);
    const a = auth(req);
    const asset = await completeUpload({
      actor: a.actor,
      asset_id: body.asset_id,
      parts: body.parts,
      upload_id: body.upload_id,
    });
    res.json({ data: { asset_id: asset._id.toString(), status: asset.status } });
  })
);

router.post(
  "/:id/abort",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    await abortUpload({ actor: a.actor, asset_id: req.params.id });
    res.json({ data: { ok: true } });
  })
);

router.get(
  "/:id/signed-url",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    if (!mongoose.isValidObjectId(req.params.id)) throw new AppError("bad_request", "bad id");
    const asset = await MediaAsset.findById(req.params.id);
    if (!asset) throw new AppError("not_found", "asset not found");
    if (asset.organization_id.toString() !== a.actor.organization_id)
      throw new AppError("forbidden", "wrong organization");
    if (asset.visibility === "internal" && !can(a.actor, "media.read_internal") && !can(a.actor, "media.publish")) {
      throw new AppError("forbidden", "not allowed");
    }
    const variant = typeof req.query.variant === "string" ? req.query.variant : null;
    const resolved = await resolveAssetUrl(asset.toObject(), variant);
    res.json({ data: resolved });
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const kind = typeof req.query.kind === "string" ? (req.query.kind as "photo" | "document" | "video") : undefined;
    const status = typeof req.query.status === "string" ? (req.query.status as never) : undefined;
    const visibility =
      typeof req.query.visibility === "string" ? (req.query.visibility as "internal" | "public") : undefined;
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const result = await listAssets(a.actor, { kind, status, visibility, cursor, limit });
    res.json({
      data: {
        items: result.items.map((r) => ({
          id: r._id.toString(),
          kind: r.kind,
          status: r.status,
          visibility: r.visibility,
          bytes: r.bytes,
          mime: r.mime_detected ?? r.mime_declared,
          width: r.width,
          height: r.height,
          duration_seconds: r.duration_seconds,
          exif_stripped: r.exif_stripped,
          alt_text: r.alt_text,
          caption: r.caption,
          flags: r.flags.map((f) => ({ reason: f.reason, at: f.at })),
          original_filename: r.original_filename,
          created_at: r.created_at,
          provider_ready: r.provider.ready,
        })),
        next_cursor: result.next_cursor,
      },
    });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(mediaUpdateBody, req.body);
    const asset = await updateAsset({ actor: a.actor, asset_id: req.params.id, ...body });
    res.json({ data: { id: asset._id.toString() } });
  })
);

router.post(
  "/:id/flag",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(mediaFlagBody, req.body);
    await flagAsset({ actor: a.actor, asset_id: req.params.id, reason: body.reason, note: body.note });
    res.json({ data: { ok: true } });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    await softDelete({ actor: a.actor, asset_id: req.params.id });
    res.json({ data: { ok: true } });
  })
);

// ---- Consent --------------------------------------------------------------

router.post(
  "/consent",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(consentBody, req.body);
    const doc = await recordConsent(a.actor, body);
    res.json({ data: { id: doc._id.toString() } });
  })
);

router.post(
  "/consent/:id/revoke",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const reason = typeof req.body?.reason === "string" ? req.body.reason : "revoked";
    await revokeConsent(a.actor, req.params.id, reason);
    res.json({ data: { ok: true } });
  })
);

export default router;
