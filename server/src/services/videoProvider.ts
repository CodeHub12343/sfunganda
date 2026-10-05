import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/config/env.js";
import { AppError } from "@/util/errors.js";
import { log } from "@/util/log.js";

// Cloudflare Stream direct-creator-upload integration.

export type StreamDirectUpload = {
  upload_url: string;
  provider_asset_id: string;
};

function configured(): boolean {
  return Boolean(env.STREAM_ACCOUNT_ID && env.STREAM_API_TOKEN);
}

export async function createDirectUpload(opts: {
  maxBytes: number;
  expirySeconds: number;
  meta?: Record<string, string>;
}): Promise<StreamDirectUpload> {
  if (!configured()) throw new AppError("unavailable", "video uploads are not configured");
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.STREAM_ACCOUNT_ID}/stream/direct_upload`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.STREAM_API_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      maxDurationSeconds: 7200,
      expiry: new Date(Date.now() + opts.expirySeconds * 1000).toISOString(),
      requireSignedURLs: true,
      allowedOrigins: [new URL(env.PUBLIC_SITE_URL).host],
      meta: opts.meta ?? {},
      // Stream enforces size via maxDurationSeconds, but keep a sanity hint.
      watermark: null,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    result?: { uploadURL?: string; uid?: string };
    errors?: Array<{ code?: number; message?: string }>;
  };
  if (!res.ok || !json.success || !json.result?.uploadURL || !json.result.uid) {
    log.error({ status: res.status, errors: json.errors }, "stream.direct_upload_failed");
    throw new AppError("unavailable", "could not start video upload");
  }
  return { upload_url: json.result.uploadURL, provider_asset_id: json.result.uid };
}

// Cloudflare Stream webhooks use `Webhook-Signature: time=..., sig1=...` with
// HMAC-SHA256 over `<time>.<body>`. See the official docs.
export function verifyStreamSignature(rawBody: string, header: string | undefined): boolean {
  if (!env.STREAM_WEBHOOK_SECRET) return false;
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.trim().split("=") as [string, string])
  );
  const time = parts.time;
  const sig = parts.sig1;
  if (!time || !sig) return false;
  // 5-minute replay window.
  const skew = Math.abs(Math.floor(Date.now() / 1000) - Number(time));
  if (!Number.isFinite(skew) || skew > 300) return false;
  const expected = createHmac("sha256", env.STREAM_WEBHOOK_SECRET)
    .update(`${time}.${rawBody}`)
    .digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(sig, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function signedPlaybackToken(playbackId: string, ttlSeconds: number): Promise<string> {
  if (!configured()) throw new AppError("unavailable", "video playback is not configured");
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.STREAM_ACCOUNT_ID}/stream/${playbackId}/token`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.STREAM_API_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ exp: Math.floor(Date.now() / 1000) + ttlSeconds }),
    }
  );
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    result?: { token?: string };
  };
  if (!res.ok || !json.success || !json.result?.token) {
    throw new AppError("unavailable", "could not sign playback token");
  }
  return json.result.token;
}
