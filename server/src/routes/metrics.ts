import { Router } from "express";
import { asyncHandler, auth, parseBody } from "./_shared.js";
import { metricDefinitionBody } from "@shared/schemas/accomplishments.js";
import { createDefinition, listDefinitions, retire } from "@/services/metrics.js";

const router = Router();

router.get(
  "/definitions",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const data = await listDefinitions(a.actor);
    res.json({ data });
  })
);

router.post(
  "/definitions",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(metricDefinitionBody, req.body);
    const doc = await createDefinition(a.actor, body);
    res.json({ data: { id: doc._id.toString(), key: doc.key } });
  })
);

router.delete(
  "/definitions/:id",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    await retire(a.actor, req.params.id);
    res.json({ data: { ok: true } });
  })
);

export default router;
