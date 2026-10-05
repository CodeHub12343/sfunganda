import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { User, RoleAssignment } from "@/models/index.js";
import { findLiveSession, readSessionCookie, touchSession } from "@/auth/sessions.js";
import type { Actor } from "@/policy/index.js";
import { AppError } from "@/util/errors.js";

export type AuthState = {
  session_id: mongoose.Types.ObjectId;
  actor: Actor;
  // The authoritative role/role-list of the actor at the time of this
  // request, suitable for stamping into audit rows.
  primary_role: string | null;
};

async function loadAuth(req: Request): Promise<AuthState | null> {
  const token = readSessionCookie(req);
  if (!token) return null;
  const session = await findLiveSession(token);
  if (!session) return null;

  const user = await User.findOne({ _id: session.user_id, status: "active" }).lean();
  if (!user) return null;

  const assignments = await RoleAssignment.find({
    user_id: user._id,
    organization_id: user.organization_id,
    revoked_at: null,
  }).lean();

  const actor: Actor = {
    user_id: user._id.toString(),
    organization_id: user.organization_id.toString(),
    mfa_verified: session.mfa_verified,
    assignments: assignments.map((a) => ({
      role: a.role,
      scope_type: a.scope_type,
      scope_id: a.scope_id ? a.scope_id.toString() : null,
    })),
  };

  // Touch session asynchronously; don't block the request.
  void touchSession(session._id);

  return { session_id: session._id, actor, primary_role: assignments[0]?.role ?? null };
}

// Resolves auth state if present; never blocks a request. Routes decide
// whether anonymous is acceptable.
export async function attachAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const state = await loadAuth(req);
    if (state) (req as unknown as { auth: AuthState }).auth = state;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const auth = (req as unknown as { auth?: AuthState }).auth;
  if (!auth) return next(new AppError("unauthorized", "sign in required"));
  // Field+/staff endpoints require MFA; the policy module enforces this per
  // action, but routes that are MFA-mandatory can also require it directly:
  next();
}

export function requireMfa(req: Request, _res: Response, next: NextFunction): void {
  const auth = (req as unknown as { auth?: AuthState }).auth;
  if (!auth) return next(new AppError("unauthorized", "sign in required"));
  if (!auth.actor.mfa_verified) {
    return next(new AppError("mfa_required", "MFA required"));
  }
  next();
}

export function getAuth(req: Request): AuthState {
  const auth = (req as unknown as { auth?: AuthState }).auth;
  if (!auth) throw new AppError("unauthorized", "sign in required");
  return auth;
}

export function getAuthOrNull(req: Request): AuthState | null {
  return (req as unknown as { auth?: AuthState }).auth ?? null;
}
