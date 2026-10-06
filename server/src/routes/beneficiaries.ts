import { Router } from "express";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { z } from "zod";
import { asyncHandler, auth, parseBody, requestCtx } from "./_shared.js";
import { AppError } from "@/util/errors.js";
import { requireStepUp } from "@/beneficiary/stepUp.js";
import { verifyTOTP } from "@/auth/mfa.js";
import { markStepUp } from "@/auth/sessions.js";
import { User } from "@/models/index.js";
import { can } from "@/policy/index.js";
import {
  addBeneficiary,
  approveTx,
  getBeneficiary,
  listBeneficiaries,
  listPending,
  rejectTx,
  reverseTx,
  submitTx,
} from "@/beneficiary/service.js";

// =============================================================================
// Phase 11 — Children's future fund admin API. Mounted under
// `/v1/beneficiaries`. Every route (except the step-up POST that opens
// the session's step-up window) requires `requireStepUp`, which refuses
// the request unless the actor has entered a fresh TOTP code in the last
// `BENEFICIARY_STEPUP_TTL_SECONDS` seconds.
// =============================================================================

const router = Router();

// Tight limiter — Phase 11 endpoints are low-volume and attempts should
// stand out in the logs.
const limiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });

// ---- Step-up challenge ------------------------------------------------------
//
// POST /v1/beneficiaries/step-up  { code }
// The user re-enters their current TOTP code. We verify it against the
// User's stored secret; on success we stamp `step_up_verified_at` on the
// session.

router.post(
  "/step-up",
  limiter,
  asyncHandler(async (req, res) => {
    const a = auth(req);
    if (!can(a.actor, "beneficiaries.read")) throw new AppError("forbidden", "step-up not available");
    const body = parseBody(z.object({ code: z.string().regex(/^\d{6}$/) }), req.body);
    const user = await User.findById(new mongoose.Types.ObjectId(a.actor.user_id)).lean();
    if (!user?.mfa_secret) throw new AppError("mfa_required", "MFA not enrolled");
    if (!verifyTOTP(user.mfa_secret, body.code)) {
      throw new AppError("unauthorized", "invalid code");
    }
    await markStepUp(a.session_id);
    res.json({ data: { ok: true } });
  })
);

// All subsequent routes require step-up MFA.
router.use(requireStepUp);
router.use(limiter);

const addBody = z.object({
  name: z.string().min(1).max(200),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  guardian: z.string().max(300).optional(),
  notes: z.string().max(2000).optional(),
});

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(addBody, req.body);
    const r = await addBeneficiary(a.actor, body, requestCtx(req));
    res.json({ data: r });
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const r = await listBeneficiaries(
      a.actor,
      {
        query: typeof req.query.q === "string" ? req.query.q : undefined,
        status: typeof req.query.status === "string" ? (req.query.status as "active" | "left" | "aged_out") : undefined,
        limit: typeof req.query.limit === "string" ? Number(req.query.limit) : undefined,
      },
      requestCtx(req)
    );
    res.json({ data: r });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const r = await getBeneficiary(a.actor, String(req.params.id), requestCtx(req));
    res.json({ data: r });
  })
);

const submitBody = z.object({
  beneficiary_id: z.string().min(1),
  public_fund_id: z.string().min(1),
  kind: z.enum(["contribution", "allocation", "distribution", "adjustment"]),
  amount_cents: z.number().int().positive(),
  currency: z.string().length(3),
  document_ref: z.string().max(60).optional(),
  note: z.string().max(1000).optional(),
  idempotency_key: z.string().min(8).max(60),
});

router.post(
  "/transactions",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(submitBody, req.body);
    const r = await submitTx(a.actor, body, requestCtx(req));
    res.json({ data: r });
  })
);

router.get(
  "/transactions/pending",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const r = await listPending(a.actor, requestCtx(req));
    res.json({ data: r });
  })
);

router.post(
  "/transactions/:id/approve",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const r = await approveTx(a.actor, String(req.params.id), requestCtx(req));
    res.json({ data: r });
  })
);

router.post(
  "/transactions/:id/reject",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(z.object({ note: z.string().max(1000).optional() }), req.body);
    await rejectTx(a.actor, String(req.params.id), body.note ?? null, requestCtx(req));
    res.json({ data: { ok: true } });
  })
);

router.post(
  "/transactions/:id/reverse",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(z.object({ reason: z.string().min(3).max(1000) }), req.body);
    const r = await reverseTx(a.actor, String(req.params.id), body.reason, requestCtx(req));
    res.json({ data: r });
  })
);

export default router;
