import mongoose from "mongoose";
import crypto from "node:crypto";
import { AppError } from "@/util/errors.js";
import { User } from "@/models/index.js";
import { verifyPassword } from "@/auth/passwords.js";
import { generateSecret, otpauthQRCodeDataURL, verifyTOTP, generateRecoveryCodes, sha256 as hash } from "@/auth/mfa.js";
import { createSession, markMfaVerified, revokeSession } from "@/auth/sessions.js";
import { writeAudit } from "./audit.js";
import type { RequestCtx } from "./users.js";

export type SignInResult =
  | { kind: "ok"; token: string; mfa_required: boolean }
  | { kind: "invalid" };

export async function signIn(
  input: { email: string; password: string },
  ctx: RequestCtx
): Promise<SignInResult> {
  const email = input.email.toLowerCase().trim();
  const user = await User.findOne({ email, status: "active" });
  if (!user || !user.password_hash) {
    // Argon-timing-safe: run a dummy verify to even out timing.
    await verifyPassword("$argon2id$v=19$m=19456,t=2,p=1$dummy$dummy", input.password).catch(() => false);
    return { kind: "invalid" };
  }
  const ok = await verifyPassword(user.password_hash, input.password);
  if (!ok) return { kind: "invalid" };

  user.last_login_at = new Date();
  user.version = (user.version ?? 0) + 1;
  await user.save();

  const mfaRequired = !!user.mfa_secret;
  const { token } = await createSession({
    organization_id: user.organization_id,
    user_id: user._id,
    mfa_verified: !mfaRequired, // if MFA not enrolled, treat as "mfa verified" so staff can enrol
    user_agent: ctx.user_agent,
    ip: ctx.ip,
  });

  await writeAudit({
    organization_id: user.organization_id,
    actor_id: user._id,
    actor_role: null,
    action: "auth.sign_in",
    entity_type: "user",
    entity_id: user._id,
    ip: ctx.ip,
    user_agent: ctx.user_agent,
    request_id: ctx.request_id,
  });

  return { kind: "ok", token, mfa_required: mfaRequired };
}

export async function signOut(session_id: mongoose.Types.ObjectId, actor_id: mongoose.Types.ObjectId, organization_id: mongoose.Types.ObjectId, ctx: RequestCtx): Promise<void> {
  await revokeSession(session_id);
  await writeAudit({
    organization_id,
    actor_id,
    actor_role: null,
    action: "auth.sign_out",
    entity_type: "session",
    entity_id: session_id,
    ip: ctx.ip,
    user_agent: ctx.user_agent,
    request_id: ctx.request_id,
  });
}

export async function startMfaEnrol(
  user_id: mongoose.Types.ObjectId
): Promise<{ secret: string; otpauth_qr: string }> {
  const user = await User.findById(user_id);
  if (!user) throw new AppError("not_found", "user not found");
  if (user.mfa_secret && user.mfa_enrolled_at) {
    throw new AppError("conflict", "MFA already enrolled");
  }
  const secret = generateSecret();
  user.mfa_secret = secret;
  user.version = (user.version ?? 0) + 1;
  await user.save();
  return { secret, otpauth_qr: await otpauthQRCodeDataURL(secret, user.email) };
}

export async function verifyMfaEnrolment(
  user_id: mongoose.Types.ObjectId,
  session_id: mongoose.Types.ObjectId,
  token: string,
  ctx: RequestCtx
): Promise<{ recovery_codes: string[] }> {
  const user = await User.findById(user_id);
  if (!user || !user.mfa_secret) throw new AppError("not_found", "no pending MFA enrolment");
  if (!verifyTOTP(user.mfa_secret, token)) {
    throw new AppError("unauthorized", "invalid MFA code");
  }
  const { codes, hashes } = generateRecoveryCodes();
  user.mfa_enrolled_at = new Date();
  user.mfa_recovery_codes_hashed = hashes;
  user.version = (user.version ?? 0) + 1;
  await user.save();
  await markMfaVerified(session_id);

  await writeAudit({
    organization_id: user.organization_id,
    actor_id: user._id,
    actor_role: null,
    action: "mfa.enrolled",
    entity_type: "user",
    entity_id: user._id,
    ip: ctx.ip,
    user_agent: ctx.user_agent,
    request_id: ctx.request_id,
  });
  return { recovery_codes: codes };
}

export async function verifyMfaLogin(
  user_id: mongoose.Types.ObjectId,
  session_id: mongoose.Types.ObjectId,
  token: string,
  ctx: RequestCtx
): Promise<void> {
  const user = await User.findById(user_id);
  if (!user || !user.mfa_secret) throw new AppError("unauthorized", "MFA not enrolled");

  if (!verifyTOTP(user.mfa_secret, token)) {
    // Allow a recovery code: one-time use, removed on success.
    const h = hash(token);
    const idx = user.mfa_recovery_codes_hashed.indexOf(h);
    if (idx === -1) throw new AppError("unauthorized", "invalid MFA code");
    user.mfa_recovery_codes_hashed.splice(idx, 1);
    user.version = (user.version ?? 0) + 1;
    await user.save();
  }

  await markMfaVerified(session_id);
  await writeAudit({
    organization_id: user.organization_id,
    actor_id: user._id,
    actor_role: null,
    action: "mfa.verified",
    entity_type: "session",
    entity_id: session_id,
    ip: ctx.ip,
    user_agent: ctx.user_agent,
    request_id: ctx.request_id,
  });
}
