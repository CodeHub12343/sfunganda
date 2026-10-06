import { Router } from "express";
import mongoose from "mongoose";
import { requireAuth } from "@/middleware/authMiddleware.js";
import { asyncHandler, auth, parseBody } from "./_shared.js";
import {
  addEmailBody,
  deletionRequestBody,
  donationClaimVerifyBody,
  donationPublicIdBody,
  followBody,
  preferencesBody,
  verifyEmailAliasBody,
} from "@shared/schemas/supporters.js";
import {
  cancelDeletion,
  exportSelf,
  requestDeletion,
  updatePreferences,
} from "@/services/supporters.js";
import {
  addEmail,
  listEmails,
  removeEmail,
  verifyEmail as verifySupporterEmail,
} from "@/services/supporterEmails.js";
import { openClaim, verifyClaim } from "@/services/donationClaims.js";
import { followProject, listMyFollows, unfollowProject } from "@/services/follows.js";
import {
  listMyNotifications,
  markAllRead,
  markRead,
  unreadCount,
} from "@/services/notifications.js";
import { Donation, SupporterProfile, User } from "@/models/index.js";
import { AppError } from "@/util/errors.js";

const router = Router();

router.use(requireAuth);

// Everything here is SELF-only: queries always filter by the authenticated
// user_id and the body is never used to specify a target.

router.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const uid = new mongoose.Types.ObjectId(a.actor.user_id);
    const orgId = new mongoose.Types.ObjectId(a.actor.organization_id);
    const [profile, follows, donationsCount, totals, unread] = await Promise.all([
      SupporterProfile.findOne({ organization_id: orgId, user_id: uid }).lean(),
      listMyFollows(a.actor.user_id, a.actor.organization_id),
      Donation.countDocuments({ organization_id: orgId, supporter_user_id: uid }),
      Donation.aggregate([
        {
          $match: {
            organization_id: orgId,
            supporter_user_id: uid,
            status: { $in: ["succeeded", "partially_refunded"] },
          },
        },
        {
          $group: {
            _id: null,
            lifetime_cents: { $sum: "$gross_base_cents" },
            currency: { $first: "$base_currency" },
          },
        },
      ]),
      unreadCount(a.actor.user_id),
    ]);
    res.json({
      data: {
        profile,
        follows,
        donations: {
          count: donationsCount,
          lifetime_cents: Number(totals[0]?.lifetime_cents ?? 0),
          currency: totals[0]?.currency ?? "USD",
        },
        unread_notifications: unread,
      },
    });
  })
);

router.get(
  "/donations",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const uid = new mongoose.Types.ObjectId(a.actor.user_id);
    const orgId = new mongoose.Types.ObjectId(a.actor.organization_id);
    const user = await User.findOne({ _id: uid, organization_id: orgId })
      .select({ email_verified_at: 1 })
      .lean();
    // Donations are NEVER shown before email verification (§Phase 7
    // security). Return an empty list so the UI can prompt verification
    // instead of leaking the count.
    if (!user?.email_verified_at) {
      res.json({ data: { items: [], unverified: true } });
      return;
    }
    const items = await Donation.find({
      organization_id: orgId,
      supporter_user_id: uid,
    })
      .sort({ received_at: -1 })
      .select({
        public_id: 1,
        gross_source_cents: 1,
        source_currency: 1,
        gross_base_cents: 1,
        base_currency: 1,
        received_at: 1,
        status: 1,
        project_id: 1,
        recurring: 1,
      })
      .limit(200)
      .lean();
    res.json({ data: { items, unverified: false } });
  })
);

// ---- Secondary emails -----------------------------------------------------

router.get(
  "/emails",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const data = await listEmails(a.actor.user_id, a.actor.organization_id);
    res.json({ data });
  })
);

router.post(
  "/emails",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(addEmailBody, req.body);
    await addEmail(a.actor.user_id, a.actor.organization_id, body.email);
    res.json({ data: { ok: true } });
  })
);

router.post(
  "/emails/verify",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(verifyEmailAliasBody, req.body);
    const r = await verifySupporterEmail(a.actor.user_id, a.actor.organization_id, body.token);
    res.json({ data: r });
  })
);

router.delete(
  "/emails/:id",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    await removeEmail(a.actor.user_id, a.actor.organization_id, String(req.params.id ?? ""));
    res.json({ data: { ok: true } });
  })
);

// ---- Donation claim -------------------------------------------------------

router.post(
  "/donations/claim",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(donationPublicIdBody, req.body);
    const r = await openClaim(a.actor.user_id, a.actor.organization_id, body.public_id);
    res.json({ data: r });
  })
);

router.post(
  "/donations/claim/verify",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(donationClaimVerifyBody, req.body);
    const r = await verifyClaim(a.actor.user_id, a.actor.organization_id, body.public_id, body.code);
    res.json({ data: r });
  })
);

// ---- Follows --------------------------------------------------------------

router.get(
  "/follows",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const data = await listMyFollows(a.actor.user_id, a.actor.organization_id);
    res.json({ data });
  })
);

router.post(
  "/follows",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(followBody, req.body);
    await followProject(a.actor.user_id, a.actor.organization_id, body.project_id);
    res.json({ data: { ok: true } });
  })
);

router.delete(
  "/follows/:project_id",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    await unfollowProject(
      a.actor.user_id,
      a.actor.organization_id,
      String(req.params.project_id ?? "")
    );
    res.json({ data: { ok: true } });
  })
);

// ---- Preferences ----------------------------------------------------------

router.get(
  "/preferences",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const p = await SupporterProfile.findOne({
      organization_id: new mongoose.Types.ObjectId(a.actor.organization_id),
      user_id: new mongoose.Types.ObjectId(a.actor.user_id),
    }).lean();
    if (!p) throw new AppError("not_found", "profile not found");
    res.json({
      data: {
        anonymous_on_wall: p.anonymous_on_wall,
        prefs: p.prefs,
      },
    });
  })
);

router.patch(
  "/preferences",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(preferencesBody, req.body);
    await updatePreferences(a.actor.user_id, {
      anonymous_on_wall: body.anonymous_on_wall,
      prefs: body.prefs,
    });
    res.json({ data: { ok: true } });
  })
);

// ---- Notifications --------------------------------------------------------

router.get(
  "/notifications",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const data = await listMyNotifications(a.actor.user_id, {
      unread_only: req.query.unread === "1" || req.query.unread === "true",
      limit: typeof req.query.limit === "string" ? Number(req.query.limit) : undefined,
      cursor: typeof req.query.cursor === "string" ? req.query.cursor : undefined,
    });
    res.json({ data });
  })
);

router.post(
  "/notifications/mark-read",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const ids = Array.isArray(req.body?.ids)
      ? (req.body.ids as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 100)
      : [];
    if (ids.length === 0 && req.body?.all) {
      await markAllRead(a.actor.user_id);
    } else {
      await markRead(a.actor.user_id, ids);
    }
    res.json({ data: { ok: true } });
  })
);

// ---- Export / deletion ----------------------------------------------------

router.get(
  "/export",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const data = await exportSelf(a.actor.user_id);
    res.setHeader("content-type", "application/json");
    res.setHeader(
      "content-disposition",
      `attachment; filename="sfu-export-${a.actor.user_id}.json"`
    );
    res.send(JSON.stringify(data, null, 2));
  })
);

router.post(
  "/delete",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(deletionRequestBody, req.body);
    const user = await User.findById(a.actor.user_id).lean();
    if (!user || user.email.toLowerCase() !== body.confirm_email.toLowerCase()) {
      throw new AppError("unprocessable", "email confirmation does not match");
    }
    const r = await requestDeletion(a.actor.user_id);
    res.json({ data: { due_at: r.due_at.toISOString() } });
  })
);

router.post(
  "/delete/cancel",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    await cancelDeletion(a.actor.user_id);
    res.json({ data: { ok: true } });
  })
);

export default router;
