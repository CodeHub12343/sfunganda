import type { NextFunction, Request, Response } from "express";
import { env } from "@/config/env.js";
import { AppError } from "@/util/errors.js";
import { readSessionStepUp } from "@/auth/sessions.js";
import type { AuthState } from "@/middleware/authMiddleware.js";

// =============================================================================
// Step-up MFA middleware (§9.3 / §19.3). The caller must have re-entered
// their TOTP code within `BENEFICIARY_STEPUP_TTL_SECONDS` of this request.
// `POST /v1/beneficiaries/step-up` sets the timestamp after verifying the
// code; this middleware checks it on every other beneficiary endpoint.
//
// Combined with the named-individual allow-list in service.ts, that
// means every request that reaches the private database has had:
//   (a) a live session (authMiddleware),
//   (b) MFA verified for the session,
//   (c) a role check (policy.can),
//   (d) the user's id in BENEFICIARY_ACCESS_USER_IDS,
//   (e) a fresh step-up within the last 5 minutes.
// =============================================================================

export async function requireStepUp(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = (req as unknown as { auth?: AuthState }).auth;
    if (!auth) return next(new AppError("unauthorized", "sign in required"));
    if (!auth.actor.mfa_verified) return next(new AppError("mfa_required", "MFA required"));

    const last = await readSessionStepUp(auth.session_id);
    const ttlMs = env.BENEFICIARY_STEPUP_TTL_SECONDS * 1000;
    if (!last || Date.now() - last.getTime() > ttlMs) {
      return next(new AppError("mfa_required", "step-up MFA required"));
    }
    next();
  } catch (err) {
    next(err);
  }
}
