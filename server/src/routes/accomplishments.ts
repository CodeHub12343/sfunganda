import { Router } from "express";
import { z } from "zod";
import { asyncHandler, auth, parseBody } from "./_shared.js";
import {
  accomplishmentBody,
  accomplishmentUpdateBody,
  approvalBody,
  submitBody,
} from "@shared/schemas/accomplishments.js";
import {
  createDraft,
  getAccomplishment,
  getRevisions,
  listAccomplishments,
  TRANSITION_NAMES,
  transition,
  updateDraft,
} from "@/services/accomplishments.js";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const data = await listAccomplishments(a.actor, {
      project_id: typeof req.query.project_id === "string" ? req.query.project_id : undefined,
      state: typeof req.query.state === "string" ? (req.query.state as never) : undefined,
      mine: req.query.mine === "1" || req.query.mine === "true",
      cursor: typeof req.query.cursor === "string" ? req.query.cursor : undefined,
      limit: typeof req.query.limit === "string" ? Number(req.query.limit) : undefined,
    });
    res.json({ data });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(accomplishmentBody, req.body);
    const doc = await createDraft(a.actor, body);
    res.json({ data: { id: doc._id.toString(), version: doc.version, state: doc.state } });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const data = await getAccomplishment(a.actor, req.params.id);
    res.json({ data });
  })
);

router.get(
  "/:id/revisions",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const data = await getRevisions(a.actor, req.params.id);
    res.json({ data });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(accomplishmentUpdateBody, req.body);
    const doc = await updateDraft(a.actor, req.params.id, body);
    res.json({ data: { id: doc._id.toString(), version: doc.version } });
  })
);

const transitionNameSchema = z.object({
  transition: z.enum(TRANSITION_NAMES as [string, ...string[]]),
  version: z.number().int().min(0),
  note: z.string().max(2000).optional(),
  safeguarding: z.record(z.boolean()).optional(),
});

router.post(
  "/:id/transition",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(transitionNameSchema, req.body);
    const doc = await transition(a.actor, req.params.id, {
      transition: body.transition as never,
      version: body.version,
      note: body.note,
      safeguarding: body.safeguarding,
    });
    res.json({ data: { id: doc._id.toString(), state: doc.state, version: doc.version, public_id: doc.public_id } });
  })
);

router.post(
  "/:id/submit",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(submitBody, req.body);
    const doc = await transition(a.actor, req.params.id, {
      transition: "submit",
      version: body.version,
      note: body.note,
    });
    res.json({ data: { id: doc._id.toString(), state: doc.state, version: doc.version } });
  })
);

router.post(
  "/:id/review/claim",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const version = Number(req.body?.version ?? 0);
    const doc = await transition(a.actor, req.params.id, { transition: "claim_review", version });
    res.json({ data: { id: doc._id.toString(), state: doc.state, version: doc.version } });
  })
);

router.post(
  "/:id/review/decide",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(approvalBody.extend({ version: z.number().int().min(0) }), req.body);
    const t = body.decision === "approve" ? "approve" : body.decision === "reject" ? "reject" : "request_changes";
    const doc = await transition(a.actor, req.params.id, {
      transition: t,
      version: body.version,
      note: body.note,
      safeguarding: body.safeguarding,
    });
    res.json({ data: { id: doc._id.toString(), state: doc.state, version: doc.version } });
  })
);

router.post(
  "/:id/publish",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const version = Number(req.body?.version ?? 0);
    const doc = await transition(a.actor, req.params.id, { transition: "publish", version });
    res.json({ data: { id: doc._id.toString(), state: doc.state, public_id: doc.public_id, version: doc.version } });
  })
);

export default router;
