import { Router } from "express";
import mongoose from "mongoose";
import { requireAuth, requireMfa } from "@/middleware/authMiddleware.js";
import { asyncHandler, auth, parseBody, requestCtx } from "./_shared.js";
import { inviteBody, assignRoleBody, objectId } from "@shared/schemas/common.js";
import { can } from "@/policy/index.js";
import { AppError } from "@/util/errors.js";
import { inviteUser, assignRole, revokeRole, setUserStatus } from "@/services/users.js";
import { User, RoleAssignment } from "@/models/index.js";

const router = Router();
router.use(requireAuth, requireMfa);

// List users (paged by cursor on _id).
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    if (!can(a.actor, "users.read")) throw new AppError("forbidden", "forbidden");

    const limit = Math.min(100, Number(req.query.limit) || 25);
    const org_id = new mongoose.Types.ObjectId(a.actor.organization_id);
    const q: Record<string, unknown> = { organization_id: org_id };
    const after = typeof req.query.after === "string" ? req.query.after : null;
    if (after && mongoose.isValidObjectId(after)) {
      q._id = { $gt: new mongoose.Types.ObjectId(after) };
    }
    const rows = await User.find(q).sort({ _id: 1 }).limit(limit).lean();
    const user_ids = rows.map((u) => u._id);
    const asgs = await RoleAssignment.find({
      organization_id: org_id,
      user_id: { $in: user_ids },
      revoked_at: null,
    }).lean();
    const by_user = new Map<string, { id: string; role: string; scope_type: string; scope_id: string | null }[]>();
    for (const a of asgs) {
      const uid = a.user_id.toString();
      if (!by_user.has(uid)) by_user.set(uid, []);
      by_user.get(uid)!.push({
        id: a._id.toString(),
        role: a.role,
        scope_type: a.scope_type,
        scope_id: a.scope_id ? a.scope_id.toString() : null,
      });
    }
    res.json({
      data: rows.map((u) => ({
        id: u._id.toString(),
        email: u.email,
        display_name: u.display_name,
        status: u.status,
        mfa_enrolled_at: u.mfa_enrolled_at,
        last_login_at: u.last_login_at,
        assignments: by_user.get(u._id.toString()) ?? [],
      })),
      next:
        rows.length === limit && rows.length > 0
          ? rows[rows.length - 1]!._id.toString()
          : null,
    });
  })
);

router.post(
  "/invite",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    if (!can(a.actor, "users.invite")) throw new AppError("forbidden", "forbidden");
    const body = parseBody(inviteBody, req.body);
    const result = await inviteUser(
      a.actor,
      {
        email: body.email,
        display_name: body.display_name,
        role: body.role,
        scope_type: body.scope_type,
        scope_id: body.scope_id ?? null,
      },
      requestCtx(req)
    );
    res.status(201).json({ data: { user_id: result.user_id } });
  })
);

router.patch(
  "/:id/roles",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    if (!can(a.actor, "users.assign_role")) throw new AppError("forbidden", "forbidden");
    const id = parseBody(objectId, req.params.id);
    const body = parseBody(assignRoleBody, req.body);
    await assignRole(
      a.actor,
      { user_id: id, role: body.role, scope_type: body.scope_type, scope_id: body.scope_id ?? null },
      requestCtx(req)
    );
    res.json({ data: { ok: true } });
  })
);

router.delete(
  "/roles/:assignment_id",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    if (!can(a.actor, "users.revoke_role")) throw new AppError("forbidden", "forbidden");
    const assignment_id = parseBody(objectId, req.params.assignment_id);
    await revokeRole(a.actor, { assignment_id }, requestCtx(req));
    res.json({ data: { ok: true } });
  })
);

router.post(
  "/:id/suspend",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    if (!can(a.actor, "users.suspend")) throw new AppError("forbidden", "forbidden");
    const id = parseBody(objectId, req.params.id);
    await setUserStatus(a.actor, { user_id: id, status: "suspended" }, requestCtx(req));
    res.json({ data: { ok: true } });
  })
);

router.post(
  "/:id/reinstate",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    if (!can(a.actor, "users.reinstate")) throw new AppError("forbidden", "forbidden");
    const id = parseBody(objectId, req.params.id);
    await setUserStatus(a.actor, { user_id: id, status: "active" }, requestCtx(req));
    res.json({ data: { ok: true } });
  })
);

export default router;
