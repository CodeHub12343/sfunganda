import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler, parseBody } from "./_shared.js";
import {
  resendVerificationBody,
  supporterSignupBody,
  verifyEmailBody,
} from "@shared/schemas/supporters.js";
import {
  oneClickUnsubscribe,
  resendVerification,
  signup,
  verifyEmail,
} from "@/services/supporters.js";

const router = Router();

// Signup is enumeration-safe but rate-limited to deter bulk discovery.
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});
const verifyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  "/signup",
  signupLimiter,
  asyncHandler(async (req, res) => {
    const body = parseBody(supporterSignupBody, req.body);
    await signup(body);
    // Constant shape; never reveals whether the email was new.
    res.json({ data: { ok: true } });
  })
);

router.post(
  "/verify",
  verifyLimiter,
  asyncHandler(async (req, res) => {
    const body = parseBody(verifyEmailBody, req.body);
    const r = await verifyEmail(body.token);
    res.json({ data: r });
  })
);

router.post(
  "/resend-verification",
  signupLimiter,
  asyncHandler(async (req, res) => {
    const body = parseBody(resendVerificationBody, req.body);
    await resendVerification(body.email);
    res.json({ data: { ok: true } });
  })
);

// One-click unsubscribe link in every email. Does not require auth — the
// token is unguessable (sha256 of a 32-byte random).
router.get(
  "/unsubscribe",
  asyncHandler(async (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    const r = await oneClickUnsubscribe(token);
    res.json({ data: r });
  })
);

export default router;
