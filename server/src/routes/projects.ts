import { Router } from "express";
import { asyncHandler, auth, parseBody } from "./_shared.js";
import {
  milestoneBody,
  milestoneUpdateBody,
  projectCreateBody,
  projectUpdateBody,
} from "@shared/schemas/projects.js";
import {
  createMilestone,
  createProject,
  getProject,
  listCategories,
  listMilestones,
  listProjects,
  updateMilestone,
  updateProject,
} from "@/services/projects.js";
import { Community } from "@/models/index.js";
import mongoose from "mongoose";
import { can } from "@/policy/index.js";
import { AppError } from "@/util/errors.js";

const router = Router();

router.get(
  "/communities",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    if (!can(a.actor, "projects.read")) throw new AppError("forbidden", "cannot list communities");
    const items = await Community.find({
      organization_id: new mongoose.Types.ObjectId(a.actor.organization_id),
    })
      .select({ _id: 1, name: 1, slug: 1, region_label: 1 })
      .sort({ name: 1 })
      .lean();
    res.json({ data: items });
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const community_id = typeof req.query.community_id === "string" ? req.query.community_id : undefined;
    const status = typeof req.query.status === "string" ? (req.query.status as never) : undefined;
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const data = await listProjects(a.actor, { community_id, status, cursor, limit });
    res.json({ data });
  })
);

router.get(
  "/categories",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const data = await listCategories(a.actor);
    res.json({ data });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(projectCreateBody, req.body);
    const doc = await createProject(a.actor, body);
    res.json({ data: { id: doc._id.toString(), slug: doc.slug, version: doc.version } });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const doc = await getProject(a.actor, req.params.id);
    res.json({ data: doc });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(projectUpdateBody, req.body);
    const doc = await updateProject(a.actor, req.params.id, body);
    res.json({ data: { id: doc._id.toString(), version: doc.version } });
  })
);

router.get(
  "/:id/milestones",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const data = await listMilestones(a.actor, req.params.id);
    res.json({ data });
  })
);

router.post(
  "/milestones",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(milestoneBody, req.body);
    const doc = await createMilestone(a.actor, body);
    res.json({ data: { id: doc._id.toString(), version: doc.version } });
  })
);

router.patch(
  "/milestones/:id",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(milestoneUpdateBody, req.body);
    const doc = await updateMilestone(a.actor, req.params.id, body);
    res.json({ data: { id: doc._id.toString(), version: doc.version } });
  })
);

export default router;
