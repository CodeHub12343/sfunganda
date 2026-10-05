import { Router } from "express";
import mongoose from "mongoose";
import { signInBody, mfaBody, acceptInviteBody } from "@shared/schemas/common.js";
import { parseBody, asyncHandler, requestCtx } from "./_shared.js";
import { signIn, signOut, startMfaEnrol, verifyMfaEnrolment, verifyMfaLogin } from "@/services/auth.js";
import { acceptInvite } from "@/services/users.js";
import { setSessionCookie, clearSessionCookie, readSessionCookie, findLiveSession } from "@/auth/sessions.js";
import { AppError } from "@/util/errors.js";
import { requireAuth } from "@/middleware/authMiddleware.js";
import rateLimit from "express-rate-limit";

const router = Router();

const signInLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  "/sign-in",
  signInLimiter,
  asyncHandler(async (req, res) => {
    const body = parseBody(signInBody, req.body);
    const result = await signIn(body, requestCtx(req));
    if (result.kind === "invalid") throw new AppError("unauthorized", "invalid credentials");
    setSessionCookie(res, result.token);
    res.json({ data: { mfa_required: result.mfa_required } });
  })
);

router.post(
  "/sign-out",
  asyncHandler(async (req, res) => {
    const token = readSessionCookie(req);
    if (token) {
      const session = await findLiveSession(token);
      if (session) {
        await signOut(session._id, session.user_id, session.organization_id, requestCtx(req));
      }
    }
    clearSessionCookie(res);
    res.json({ data: { ok: true } });
  })
);

// Begin MFA enrolment (returns the otpauth URL as a data: QR). Requires an
// authenticated session; MFA need not be verified yet.
router.post(
  "/mfa/enrol",
  requireAuth,
  asyncHandler(async (req, res) => {
    const auth = (req as unknown as { auth: { actor: { user_id: string } } }).auth;
    const result = await startMfaEnrol(new mongoose.Types.ObjectId(auth.actor.user_id));
    res.json({ data: { otpauth_qr: result.otpauth_qr } });
  })
);

router.post(
  "/mfa/verify-enrol",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = parseBody(mfaBody, req.body);
    const authState = (req as unknown as { auth: { actor: { user_id: string }; session_id: mongoose.Types.ObjectId } }).auth;
    const r = await verifyMfaEnrolment(
      new mongoose.Types.ObjectId(authState.actor.user_id),
      authState.session_id,
      body.token,
      requestCtx(req)
    );
    res.json({ data: { recovery_codes: r.recovery_codes } });
  })
);

// Finish MFA at login — the user has a session but mfa_verified = false.
router.post(
  "/mfa/verify",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = parseBody(mfaBody, req.body);
    const authState = (req as unknown as { auth: { actor: { user_id: string }; session_id: mongoose.Types.ObjectId } }).auth;
    await verifyMfaLogin(
      new mongoose.Types.ObjectId(authState.actor.user_id),
      authState.session_id,
      body.token,
      requestCtx(req)
    );
    res.json({ data: { ok: true } });
  })
);

// Accept an invitation. Public endpoint — carries the token.
router.post(
  "/invite/accept",
  asyncHandler(async (req, res) => {
    const body = parseBody(acceptInviteBody, req.body);
    const result = await acceptInvite(body.token, body.password, requestCtx(req));
    res.json({ data: result });
  })
);

export default router;
