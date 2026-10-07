import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireMfa } from "@/middleware/authMiddleware.js";
import { asyncHandler, auth, parseBody, requestCtx } from "./_shared.js";
import { objectId, nonEmpty } from "@shared/schemas/common.js";
import {
  createBusiness,
  updateBusiness,
  approveBusiness,
  retireBusiness,
  listBusinesses,
} from "@/services/businesses.js";
import {
  submitProduction,
  approveProduction,
  rejectProduction,
  listProduction,
} from "@/services/businessProduction.js";

const router = Router();
router.use(requireAuth, requireMfa);

const kindEnum = z.enum(["farming", "livestock", "poultry", "crafts", "retail", "services", "other"]);
const statusEnum = z.enum(["planned", "active", "paused", "retired"]);
const unitEnum = z.enum(["kg", "g", "l", "ml", "unit", "pack", "dozen", "hour", "other"]);
const slug = z.string().regex(/^[a-z0-9-]{1,120}$/);

const businessCreate = z.object({
  slug,
  name: nonEmpty(160),
  kind: kindEnum,
  summary: z.string().max(2000).optional(),
  community_id: objectId.nullable().optional(),
  manager_id: objectId.nullable().optional(),
  fund_id: objectId.nullable().optional(),
  status: statusEnum.optional(),
});

const businessUpdate = z.object({
  name: nonEmpty(160).optional(),
  kind: kindEnum.optional(),
  summary: z.string().max(2000).optional(),
  community_id: objectId.nullable().optional(),
  manager_id: objectId.nullable().optional(),
  fund_id: objectId.nullable().optional(),
  status: statusEnum.optional(),
  version: z.number().int().nonnegative(),
});

const productionSubmit = z.object({
  business_id: objectId,
  caption: z.string().max(500),
  quantity: z.number().nonnegative(),
  unit: unitEnum,
  source_currency: z.string().length(3),
  gross_source_cents: z.number().int().positive(),
  occurred_on: z.coerce.date(),
  idempotency_key: z.string().max(120).optional().nullable(),
});

// ----- Businesses -----

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const data = await listBusinesses(a.actor, {
      after: typeof req.query.after === "string" ? req.query.after : null,
      limit: typeof req.query.limit === "string" ? Number(req.query.limit) : undefined,
      community_id: typeof req.query.community_id === "string" ? req.query.community_id : null,
    });
    res.json({ data: data.items, next: data.next });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(businessCreate, req.body);
    const r = await createBusiness(a.actor, body, requestCtx(req));
    res.status(201).json({ data: r });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const id = parseBody(objectId, req.params.id);
    const body = parseBody(businessUpdate, req.body);
    await updateBusiness(a.actor, id, body, requestCtx(req));
    res.json({ data: { ok: true } });
  })
);

router.post(
  "/:id/approve",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const id = parseBody(objectId, req.params.id);
    await approveBusiness(a.actor, id, requestCtx(req));
    res.json({ data: { ok: true } });
  })
);

router.post(
  "/:id/retire",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const id = parseBody(objectId, req.params.id);
    await retireBusiness(a.actor, id, requestCtx(req));
    res.json({ data: { ok: true } });
  })
);

// ----- Production -----

router.get(
  "/production/list",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const r = await listProduction(a.actor, {
      business_id: typeof req.query.business_id === "string" ? req.query.business_id : null,
      state: typeof req.query.state === "string" ? req.query.state : null,
      after: typeof req.query.after === "string" ? req.query.after : null,
      limit: typeof req.query.limit === "string" ? Number(req.query.limit) : undefined,
    });
    res.json({ data: r.items, next: r.next });
  })
);

router.post(
  "/production",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(productionSubmit, req.body);
    const r = await submitProduction(a.actor, body, requestCtx(req));
    res.status(201).json({ data: r });
  })
);

router.post(
  "/production/:id/approve",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const id = parseBody(objectId, req.params.id);
    const r = await approveProduction(a.actor, id, requestCtx(req));
    res.json({ data: r });
  })
);

router.post(
  "/production/:id/reject",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const id = parseBody(objectId, req.params.id);
    const body = parseBody(z.object({ reason: nonEmpty(1000) }), req.body);
    await rejectProduction(a.actor, id, body.reason, requestCtx(req));
    res.json({ data: { ok: true } });
  })
);

export default router;
