import { env } from "@/config/env.js";
import { bucketName, presignUrl, type LogicalBucket } from "./storage.js";
import { signedPlaybackToken } from "./videoProvider.js";
import type { MediaAssetDoc } from "@/models/MediaAsset.js";

// Short-TTL signed URL for a media asset. Public (derivatives) assets return
// the CDN URL directly where configured. Documents are ALWAYS signed and
// served from the separate documents origin.

export type ResolvedUrl = {
  url: string;
  expires_at: string | null;
  kind: "public" | "signed_r2" | "stream";
};

function logicalFor(bucket: string): LogicalBucket | null {
  if (bucket === env.R2_BUCKET_ORIGINALS) return "originals";
  if (bucket === env.R2_BUCKET_DERIVATIVES) return "derivatives";
  if (bucket === env.R2_BUCKET_DOCUMENTS) return "documents";
  return null;
}

export async function resolveAssetUrl(
  asset: MediaAssetDoc,
  variant: string | null = null
): Promise<ResolvedUrl> {
  if (asset.kind === "video" && asset.provider.name === "stream" && asset.provider.playback_id) {
    const token = await signedPlaybackToken(asset.provider.playback_id, env.R2_SIGNED_URL_TTL_SECONDS);
    const url = `https://customer-${env.STREAM_ACCOUNT_ID}.cloudflarestream.com/${token}/manifest/video.m3u8`;
    return {
      url,
      expires_at: new Date(Date.now() + env.R2_SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
      kind: "stream",
    };
  }

  // Choose the right bucket/key. Variant may name a derivative.
  let bucket = asset.bucket;
  let key = asset.key;
  if (variant) {
    const d = asset.derivatives.find((x) => x.variant === variant);
    if (d) {
      bucket = d.bucket;
      key = d.key;
    }
  }

  // Public derivatives: return CDN URL where configured.
  if (
    asset.visibility === "public" &&
    bucket === env.R2_BUCKET_DERIVATIVES &&
    env.R2_PUBLIC_DERIVATIVES_URL
  ) {
    const base = env.R2_PUBLIC_DERIVATIVES_URL.replace(/\/$/, "");
    return { url: `${base}/${key}`, expires_at: null, kind: "public" };
  }

  const logical = logicalFor(bucket);
  const ttl = env.R2_SIGNED_URL_TTL_SECONDS;
  const url = presignUrl({
    method: "GET",
    bucket,
    key,
    ttlSeconds: ttl,
    responseContentDisposition:
      logical === "documents" ? `attachment; filename="${sanitize(asset.original_filename)}"` : undefined,
  });
  return { url, expires_at: new Date(Date.now() + ttl * 1000).toISOString(), kind: "signed_r2" };
}

function sanitize(name: string): string {
  return name.replace(/["\\\r\n]/g, "_").slice(0, 200);
}

export function logicalForBucket(bucket: string): LogicalBucket | null {
  return logicalFor(bucket);
}

export function bucketFor(logical: LogicalBucket): string {
  return bucketName(logical);
}
