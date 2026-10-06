import crypto from "node:crypto";
import mongoose from "mongoose";
import { env } from "@/config/env.js";
import { AppError } from "@/util/errors.js";
import { can, type Actor } from "@/policy/index.js";
import { SocialConnection, type SocialConnectionDoc } from "@/models/SocialConnection.js";
import { encryptToken, decryptToken } from "@/services/socialTokens.js";
import { getPublisher, type SocialPublisher, AVAILABLE_PLATFORMS } from "./publishers.js";

// =============================================================================
// OAuth begin / callback helpers + connection lifecycle. The route layer
// does the HTTP wiring; this module handles state generation, token
// storage, and the reconnect flow.
// =============================================================================

export type Platform = "youtube" | "facebook" | "instagram" | "tiktok";

export function callbackUrl(platform: Platform): string {
  const base = env.SOCIAL_OAUTH_CALLBACK_BASE ?? env.PUBLIC_SITE_URL;
  const trimmed = base.replace(/\/$/, "");
  return `${trimmed}/api/v1/social/oauth/${platform}/callback`;
}

// We encode the state as HMAC(platform|org|user|nonce|exp) so the callback
// can verify the request without touching storage. 10 minute expiry.
function stateKey(): Buffer {
  const k = env.SOCIAL_TOKEN_KEY;
  if (!k) throw new AppError("unavailable", "SOCIAL_TOKEN_KEY is not configured");
  const buf = Buffer.from(k, "base64");
  if (buf.length !== 32) throw new AppError("unavailable", "SOCIAL_TOKEN_KEY is not 32 bytes");
  return buf;
}

export function issueState(args: {
  platform: Platform;
  organization_id: string;
  user_id: string;
}): string {
  const nonce = crypto.randomBytes(12).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 600;
  const body = `${args.platform}|${args.organization_id}|${args.user_id}|${nonce}|${exp}`;
  const mac = crypto
    .createHmac("sha256", stateKey())
    .update(body)
    .digest("base64url");
  return `${Buffer.from(body).toString("base64url")}.${mac}`;
}

export function verifyState(raw: string): {
  platform: Platform;
  organization_id: string;
  user_id: string;
} {
  const [b64, mac] = raw.split(".");
  if (!b64 || !mac) throw new AppError("bad_request", "invalid state");
  const body = Buffer.from(b64, "base64url").toString();
  const expected = crypto
    .createHmac("sha256", stateKey())
    .update(body)
    .digest("base64url");
  // Timing-safe compare — short-circuits lengthwise.
  if (expected.length !== mac.length) throw new AppError("bad_request", "invalid state");
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(mac))) {
    throw new AppError("bad_request", "invalid state");
  }
  const [platform, organization_id, user_id, , expStr] = body.split("|");
  if (!platform || !organization_id || !user_id || !expStr) {
    throw new AppError("bad_request", "invalid state");
  }
  if (Math.floor(Date.now() / 1000) > Number(expStr)) {
    throw new AppError("bad_request", "state expired, please reconnect");
  }
  return {
    platform: platform as Platform,
    organization_id,
    user_id,
  };
}

export function beginOAuth(actor: Actor, platform: Platform): { url: string } {
  if (!env.SOCIAL_ENABLED) throw new AppError("not_found", "social cross-posting is disabled");
  if (!can(actor, "social.connect")) throw new AppError("forbidden", "cannot connect social accounts");
  const pub = getPublisher(platform);
  if (!pub.oauthStart) throw new AppError("unavailable", `${platform} oauth is not available`);
  const redirect_uri = callbackUrl(platform);
  const state = issueState({
    platform,
    organization_id: actor.organization_id,
    user_id: actor.user_id,
  });
  return { url: pub.oauthStart(state, redirect_uri) };
}

export async function completeOAuth(args: {
  platform: Platform;
  code: string;
  state: string;
}): Promise<{ connection_id: string; channel_name: string }> {
  if (!env.SOCIAL_ENABLED) throw new AppError("not_found", "social cross-posting is disabled");
  const verified = verifyState(args.state);
  if (verified.platform !== args.platform) {
    throw new AppError("bad_request", "state does not match callback platform");
  }
  const pub = getPublisher(args.platform);
  if (!pub.exchangeCode) throw new AppError("unavailable", "oauth exchange not supported");
  const tokens = await pub.exchangeCode({ code: args.code, redirect_uri: callbackUrl(args.platform) });

  const orgId = new mongoose.Types.ObjectId(verified.organization_id);
  // Revoke any existing active connection for this (platform, channel).
  await SocialConnection.updateMany(
    {
      organization_id: orgId,
      platform: args.platform,
      channel_id: tokens.channel_id,
      status: "active",
    },
    { $set: { status: "revoked", revoked_at: new Date() } }
  );

  const row = (await SocialConnection.create({
    organization_id: orgId,
    platform: args.platform,
    channel_id: tokens.channel_id,
    channel_name: tokens.channel_name,
    refresh_token_ct: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
    access_token_ct: encryptToken(tokens.access_token),
    access_token_expires_at: tokens.expires_at,
    scopes: tokens.scopes,
    status: "active",
    connected_by: new mongoose.Types.ObjectId(verified.user_id),
    connected_at: new Date(),
  })) as unknown as SocialConnectionDoc;
  return { connection_id: row._id.toString(), channel_name: row.channel_name };
}

export async function listConnections(actor: Actor): Promise<Array<{
  id: string;
  platform: Platform;
  channel_name: string;
  status: string;
  connected_at: string;
  last_error: string | null;
}>> {
  if (!can(actor, "social.read")) throw new AppError("forbidden", "cannot read social connections");
  const rows = (await SocialConnection.find({
    organization_id: new mongoose.Types.ObjectId(actor.organization_id),
  })
    .sort({ created_at: -1 })
    .lean()) as SocialConnectionDoc[];
  return rows.map((r) => ({
    id: r._id.toString(),
    platform: r.platform as Platform,
    channel_name: r.channel_name,
    status: r.status,
    connected_at: r.connected_at.toISOString(),
    last_error: r.last_error,
  }));
}

export async function revokeConnection(actor: Actor, id: string): Promise<void> {
  if (!can(actor, "social.connect")) throw new AppError("forbidden", "cannot revoke connections");
  const orgId = new mongoose.Types.ObjectId(actor.organization_id);
  const row = await SocialConnection.findOne({ _id: new mongoose.Types.ObjectId(id), organization_id: orgId });
  if (!row) throw new AppError("not_found", "connection not found");
  if (row.status !== "active") return;
  row.status = "revoked";
  row.revoked_at = new Date();
  row.revoked_by = new mongoose.Types.ObjectId(actor.user_id);
  // Zero the tokens on revoke so even an operator with DB read can't
  // reuse them. The row stays for the audit trail.
  row.refresh_token_ct = null;
  row.access_token_ct = null;
  await row.save();
}

// Returns a fresh access token, refreshing from the stored refresh_token
// if the access token has expired. Called by the worker right before
// `publisher.publish`.
export async function liveAccessToken(connection: SocialConnectionDoc): Promise<string | null> {
  if (!connection.access_token_ct) return null;
  const now = Date.now();
  const buffer = 60_000; // refresh 1 minute before expiry
  if (!connection.access_token_expires_at || connection.access_token_expires_at.getTime() - now > buffer) {
    return decryptToken(connection.access_token_ct);
  }
  if (!connection.refresh_token_ct) return decryptToken(connection.access_token_ct);
  const pub = getPublisher(connection.platform);
  if (!pub.refresh) return decryptToken(connection.access_token_ct);
  const refreshed = await pub.refresh(decryptToken(connection.refresh_token_ct));
  // Persist the new token so the next worker tick doesn't repeat the
  // refresh.
  await SocialConnection.updateOne(
    { _id: connection._id },
    {
      $set: {
        access_token_ct: encryptToken(refreshed.access_token),
        access_token_expires_at: refreshed.expires_at,
        last_error: null,
      },
    }
  );
  return refreshed.access_token;
}

// Returns the publishers that are configured on this environment — used
// by the admin UI to show/hide platform-specific Connect buttons.
export function availablePlatforms(): Array<{ platform: Platform; configured: boolean }> {
  return AVAILABLE_PLATFORMS.map((p) => {
    const pub = getPublisher(p);
    return { platform: p, configured: pub.configured };
  });
}

export type { SocialPublisher };
