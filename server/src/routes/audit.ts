import { Router } from "express";
import mongoose from "mongoose";
import { requireAuth, requireMfa } from "@/middleware/authMiddleware.js";
import { asyncHandler, auth } from "./_shared.js";
import { can } from "@/policy/index.js";
import { AppError } from "@/util/errors.js";
import { AuditLog } from "@/models/index.js";

const router = Router();
router.use(requireAuth, requireMfa);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    if (!can(a.actor, "audit.read", { kind: "audit", organization_id: a.actor.organization_id })) {
      throw new AppError("forbidden", "forbidden");
    }

    const org_id = new mongoose.Types.ObjectId(a.actor.organization_id);
    const limit = Math.min(100, Number(req.query.limit) || 25);
    const q: Record<string, unknown> = { organization_id: org_id };
    const after = typeof req.query.after === "string" ? req.query.after : null;
    if (after && mongoose.isValidObjectId(after)) {
      q._id = { $lt: new mongoose.Types.ObjectId(after) };
    }
    const entityType = typeof req.query.entity_type === "string" ? req.query.entity_type.slice(0, 60) : null;
    if (entityType) q.entity_type = entityType;
    const action = typeof req.query.action === "string" ? req.query.action.slice(0, 100) : null;
    if (action) q.action = action;

    const rows = await AuditLog.find(q).sort({ _id: -1 }).limit(limit).lean();
    res.json({
      data: rows.map((r) => ({
        id: r._id.toString(),
        at: r.at,
        action: r.action,
        actor_id: r.actor_id ? r.actor_id.toString() : null,
        actor_role: r.actor_role,
        entity_type: r.entity_type,
        entity_id: r.entity_id ? r.entity_id.toString() : null,
        before: r.before,
        after: r.after,
        request_id: r.request_id,
      })),
      next:
        rows.length === limit && rows.length > 0
          ? rows[rows.length - 1]!._id.toString()
          : null,
    });
  })
);

export default router;
