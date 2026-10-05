import crypto from "node:crypto";
import type { Request, Response } from "express";
import mongoose from "mongoose";
import { env } from "@/config/env.js";
import { Session, type SessionDoc } from "@/models/Session.js";

export const COOKIE_NAME = env.SESSION_COOKIE_NAME;

export function newSessionToken(): string {
  // 32 bytes base64url. Stored hashed; the plaintext is in the cookie.
  return crypto.randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createSession(opts: {
  organization_id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  mfa_verified: boolean;
  user_agent: string;
  ip: string;
}): Promise<{ token: string; doc: SessionDoc }> {
  const token = newSessionToken();
  const ttlMs = env.SESSION_TTL_HOURS * 3600 * 1000;
  const doc = await Session.create({
    organization_id: opts.organization_id,
    user_id: opts.user_id,
    token_hash: hashToken(token),
    mfa_verified: opts.mfa_verified,
    user_agent: opts.user_agent.slice(0, 500),
    ip: opts.ip.slice(0, 64),
    issued_at: new Date(),
    last_seen_at: new Date(),
    expires_at: new Date(Date.now() + ttlMs),
  });
  return { token, doc };
}

export function setSessionCookie(res: Response, token: string): void {
  const ttlSeconds = env.SESSION_TTL_HOURS * 3600;
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.SESSION_COOKIE_SECURE,
    sameSite: "lax",
    domain: env.SESSION_COOKIE_DOMAIN,
    maxAge: ttlSeconds * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: env.SESSION_COOKIE_SECURE,
    sameSite: "lax",
    domain: env.SESSION_COOKIE_DOMAIN,
    path: "/",
  });
}

export function readSessionCookie(req: Request): string | null {
  const raw = (req as unknown as { cookies?: Record<string, string> }).cookies?.[COOKIE_NAME];
  return raw ?? null;
}

export async function findLiveSession(token: string): Promise<SessionDoc | null> {
  const doc = await Session.findOne({
    token_hash: hashToken(token),
    revoked_at: null,
    expires_at: { $gt: new Date() },
  }).lean<SessionDoc>();
  return doc;
}

export async function markMfaVerified(session_id: mongoose.Types.ObjectId): Promise<void> {
  await Session.updateOne({ _id: session_id }, { $set: { mfa_verified: true } });
}

export async function touchSession(session_id: mongoose.Types.ObjectId): Promise<void> {
  await Session.updateOne({ _id: session_id }, { $set: { last_seen_at: new Date() } });
}

export async function revokeSession(session_id: mongoose.Types.ObjectId): Promise<void> {
  await Session.updateOne({ _id: session_id }, { $set: { revoked_at: new Date() } });
}
