import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireMfa } from "@/middleware/authMiddleware.js";
import { asyncHandler, auth, parseBody, requestCtx } from "./_shared.js";
import { objectId, nonEmpty } from "@shared/schemas/common.js";
import {
  createReport,
  editReport,
  compileReport,
  signFinance,
  approveReport,
  publishReport,
  archiveReport,
  requestExport,
  listReports,
  getReportAdmin,
} from "@/services/reports.js";

const router = Router();
router.use(requireAuth, requireMfa);

const createSchema = z.object({
  period_kind: z.enum(["month", "quarter", "year"]),
  period_code: z.string().regex(/^\d{4}(-(\d{2}|Q[1-4]))?$/),
  title: nonEmpty(200),
});

const editSchema = z.object({
  title: nonEmpty(200).optional(),
  summary: z.string().max(2000).optional(),
  body_markdown: z.string().max(50_000).optional(),
  selected_accomplishment_public_ids: z.array(z.string().max(40)).max(50).optional(),
  selected_media_ids: z.array(objectId).max(20).optional(),
  version: z.number().int().nonnegative(),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const r = await listReports(a.actor, {
      state: typeof req.query.state === "string" ? req.query.state : null,
      after: typeof req.query.after === "string" ? req.query.after : null,
      limit: typeof req.query.limit === "string" ? Number(req.query.limit) : undefined,
    });
    res.json({ data: r.items, next: r.next });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(createSchema, req.body);
    const r = await createReport(a.actor, body, requestCtx(req));
    res.status(201).json({ data: r });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const id = parseBody(objectId, req.params.id);
    res.json({ data: await getReportAdmin(a.actor, id) });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const id = parseBody(objectId, req.params.id);
    const body = parseBody(editSchema, req.body);
    await editReport(a.actor, id, body, requestCtx(req));
    res.json({ data: { ok: true } });
  })
);

router.post(
  "/:id/compile",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const id = parseBody(objectId, req.params.id);
    const r = await compileReport(a.actor, id, requestCtx(req));
    res.json({ data: r });
  })
);

router.post(
  "/:id/sign-finance",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const id = parseBody(objectId, req.params.id);
    await signFinance(a.actor, id, requestCtx(req));
    res.json({ data: { ok: true } });
  })
);

router.post(
  "/:id/approve",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const id = parseBody(objectId, req.params.id);
    await approveReport(a.actor, id, requestCtx(req));
    res.json({ data: { ok: true } });
  })
);

router.post(
  "/:id/publish",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const id = parseBody(objectId, req.params.id);
    await publishReport(a.actor, id, requestCtx(req));
    res.json({ data: { ok: true } });
  })
);

router.post(
  "/:id/archive",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const id = parseBody(objectId, req.params.id);
    await archiveReport(a.actor, id, requestCtx(req));
    res.json({ data: { ok: true } });
  })
);

router.post(
  "/:id/export",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const id = parseBody(objectId, req.params.id);
    const r = await requestExport(a.actor, id, requestCtx(req));
    res.status(202).json({ data: r });
  })
);

export default router;
