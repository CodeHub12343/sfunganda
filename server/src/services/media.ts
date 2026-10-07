import mongoose from "mongoose";
import { env } from "@/config/env.js";
import { AppError } from "@/util/errors.js";
import { log } from "@/util/log.js";
import { MediaAsset, MediaLink } from "@/models/index.js";
import type { MediaAssetDoc, MediaKind, MediaVisibility } from "@/models/MediaAsset.js";
import {
  abortMultipartUpload,
  buildKey,
  completeMultipartUpload,
  initMultipartUpload,
  presignUploadPartUrl,
  presignUrl,
  bucketName,
  type LogicalBucket,
} from "./storage.js";
import { allowedMimeForKind } from "./mediaProcessing.js";
import { enqueue } from "./outbox.js";
import type { Actor } from "@/policy/index.js";
import { can } from "@/policy/index.js";

export type Ticket = {
  asset_id: string;
  kind: MediaKind;
  // For R2 small-file uploads
  upload_url?: string;
  // For R2 multipart uploads
  multipart?: {
    upload_id: string;
    part_size: number;
    part_urls: string[];
  };
  // For Cloudflare Stream direct upload
  provider_upload_url?: string;
  provider_asset_id?: string;
  // Metadata echoed back for the client
  bucket: string;
  key: string;
  expires_at: string;
};

const PART_SIZE = 8 * 1024 * 1024; // 8 MiB — fits within R2's 5 MiB minimum and keeps part count low.
const MULTIPART_THRESHOLD = 16 * 1024 * 1024; // Above 16 MiB, go multipart.

export function maxBytesForKind(kind: MediaKind): number {
  if (kind === "photo") return env.MEDIA_MAX_PHOTO_BYTES;
  if (kind === "document") return env.MEDIA_MAX_DOCUMENT_BYTES;
  return env.MEDIA_MAX_VIDEO_BYTES;
}

function logicalBucketFor(kind: MediaKind, visibility: MediaVisibility): LogicalBucket {
  if (kind === "document") return "documents";
  // Public videos go straight to the derivatives bucket so they can be served
  // over the public r2.dev / CDN URL without a per-request signing round-trip
  // (we have no transcoding step — the raw .mp4 is what plays).
  if (kind === "video" && visibility === "public") return "derivatives";
  return "originals";
}

export async function createTicket(input: {
  actor: Actor;
  kind: MediaKind;
  mime: string;
  bytes: number;
  filename: string;
  visibility: MediaVisibility;
  sha256?: string;
  alt_text?: string;
  via_provider?: boolean;
  link?: { target: string; id: string; role?: string };
}): Promise<Ticket> {
  if (!can(input.actor, "media.upload")) {
    throw new AppError("forbidden", "you cannot upload media");
  }
  if (!allowedMimeForKind(input.kind, input.mime)) {
    throw new AppError("unprocessable", "file type not allowed", { fields: { mime: "unsupported" } });
  }
  const cap = maxBytesForKind(input.kind);
  if (input.bytes <= 0 || input.bytes > cap) {
    throw new AppError("unprocessable", "file size out of range", {
      fields: { bytes: `must be 1..${cap}` },
    });
  }

  const orgId = new mongoose.Types.ObjectId(input.actor.organization_id);

  // `via_provider` previously requested a Cloudflare Stream direct upload.
  // Stream has been removed (no budget); the flag is now a no-op — videos
  // go through the same R2 presigned-upload path as photos and documents.
  void input.via_provider;

  const logical = logicalBucketFor(input.kind, input.visibility);
  const bucket = bucketName(logical);
  const prefix = input.kind;
  const key = buildKey(prefix, input.filename);
  const multipart = input.bytes > MULTIPART_THRESHOLD;

  const asset = await MediaAsset.create({
    organization_id: orgId,
    kind: input.kind,
    status: "uploading",
    visibility: input.visibility,
    bucket,
    key,
    mime_declared: input.mime,
    bytes: input.bytes,
    sha256: input.sha256 ?? null,
    original_filename: input.filename,
    alt_text: input.alt_text ?? null,
    uploaded_by: new mongoose.Types.ObjectId(input.actor.user_id),
  });
  await maybeLink(asset._id, orgId, input.link, input.actor.user_id);

  const ttl = env.R2_UPLOAD_URL_TTL_SECONDS;
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
  if (!multipart) {
    const url = presignUrl({
      method: "PUT",
      bucket,
      key,
      ttlSeconds: ttl,
      contentType: input.mime,
    });
    return {
      asset_id: asset._id.toString(),
      kind: input.kind,
      upload_url: url,
      bucket,
      key,
      expires_at: expiresAt,
    };
  }

  const uploadId = await initMultipartUpload(bucket, key, input.mime);
  const partCount = Math.ceil(input.bytes / PART_SIZE);
  const urls = Array.from({ length: partCount }, (_, idx) =>
    presignUploadPartUrl(bucket, key, uploadId, idx + 1, ttl)
  );
  await MediaAsset.updateOne(
    { _id: asset._id },
    { $set: { "upload.multipart_upload_id": uploadId } }
  );
  return {
    asset_id: asset._id.toString(),
    kind: input.kind,
    multipart: { upload_id: uploadId, part_size: PART_SIZE, part_urls: urls },
    bucket,
    key,
    expires_at: expiresAt,
  };
}

async function maybeLink(
  asset_id: mongoose.Types.ObjectId,
  organization_id: mongoose.Types.ObjectId,
  link: { target: string; id: string; role?: string } | undefined,
  user_id: string
): Promise<void> {
  if (!link) return;
  await MediaLink.create({
    organization_id,
    asset_id,
    target: link.target,
    target_id: new mongoose.Types.ObjectId(link.id),
    role: link.role ?? null,
    created_by: new mongoose.Types.ObjectId(user_id),
  });
}

export async function completeUpload(input: {
  actor: Actor;
  asset_id: string;
  parts?: Array<{ part_number: number; etag: string }>;
  upload_id?: string;
}): Promise<MediaAssetDoc> {
  const asset = await MediaAsset.findById(input.asset_id);
  if (!asset) throw new AppError("not_found", "asset not found");
  if (asset.organization_id.toString() !== input.actor.organization_id)
    throw new AppError("forbidden", "wrong organization");
  if (asset.status !== "uploading") throw new AppError("conflict", "asset is not in uploading state");

  if (asset.upload.multipart_upload_id) {
    const parts = input.parts;
    if (!parts || parts.length === 0) throw new AppError("bad_request", "parts required");
    await completeMultipartUpload(asset.bucket, asset.key, asset.upload.multipart_upload_id, parts);
    asset.upload.parts_received = parts.length;
    asset.upload.multipart_upload_id = null;
  }
  asset.uploaded_at = new Date();
  // Worker is disabled, so there is no media.process job to run. Finalize
  // every kind inline: trust the uploader's declared MIME, skip virus scan,
  // skip EXIF stripping, skip derivatives. The raw object in R2 is what gets
  // served (progressive .mp4 for video, original .jpg/.png for photos).
  asset.status = "ready";
  if (asset.kind === "video") asset.provider.ready = true;
  await asset.save();
  return asset.toObject();
}

export async function abortUpload(input: { actor: Actor; asset_id: string }): Promise<void> {
  const asset = await MediaAsset.findById(input.asset_id);
  if (!asset) return;
  if (asset.organization_id.toString() !== input.actor.organization_id)
    throw new AppError("forbidden", "wrong organization");
  if (asset.upload.multipart_upload_id) {
    await abortMultipartUpload(asset.bucket, asset.key, asset.upload.multipart_upload_id);
  }
  asset.status = "deleted";
  asset.deleted_at = new Date();
  await asset.save();
}

export async function flagAsset(input: {
  actor: Actor;
  asset_id: string;
  reason: "unsafe" | "offtopic" | "copyright" | "pii" | "other";
  note?: string;
}): Promise<void> {
  if (!can(input.actor, "media.publish")) throw new AppError("forbidden", "cannot flag");
  const asset = await MediaAsset.findById(input.asset_id);
  if (!asset) throw new AppError("not_found", "asset not found");
  if (asset.organization_id.toString() !== input.actor.organization_id)
    throw new AppError("forbidden", "wrong organization");
  asset.flags.push({
    reason: input.reason,
    note: input.note ?? null,
    by_user_id: new mongoose.Types.ObjectId(input.actor.user_id),
    at: new Date(),
    resolved_at: null,
  });
  if (input.reason === "unsafe" || input.reason === "pii") {
    asset.visibility = "internal";
  }
  await asset.save();
}

export async function updateAsset(input: {
  actor: Actor;
  asset_id: string;
  alt_text?: string;
  caption?: string;
  visibility?: MediaVisibility;
}): Promise<MediaAssetDoc> {
  if (!can(input.actor, "media.publish")) throw new AppError("forbidden", "cannot update media");
  const asset = await MediaAsset.findById(input.asset_id);
  if (!asset) throw new AppError("not_found", "asset not found");
  if (asset.organization_id.toString() !== input.actor.organization_id)
    throw new AppError("forbidden", "wrong organization");
  if (input.alt_text !== undefined) asset.alt_text = input.alt_text;
  if (input.caption !== undefined) asset.caption = input.caption;
  if (input.visibility !== undefined) asset.visibility = input.visibility;
  await asset.save();
  return asset.toObject();
}

export async function softDelete(input: { actor: Actor; asset_id: string }): Promise<void> {
  if (!can(input.actor, "media.publish")) throw new AppError("forbidden", "cannot delete");
  const asset = await MediaAsset.findById(input.asset_id);
  if (!asset) return;
  if (asset.organization_id.toString() !== input.actor.organization_id)
    throw new AppError("forbidden", "wrong organization");
  asset.status = "deleted";
  asset.deleted_at = new Date();
  await asset.save();
  await enqueue({
    organization_id: asset.organization_id,
    topic: "media.cleanup",
    payload: { asset_id: asset._id.toString() },
  });
}

export type ListOpts = {
  kind?: MediaKind;
  status?: MediaAssetDoc["status"];
  visibility?: MediaVisibility;
  cursor?: string;
  limit?: number;
};

export async function listAssets(actor: Actor, opts: ListOpts): Promise<{
  items: MediaAssetDoc[];
  next_cursor: string | null;
}> {
  if (!can(actor, "media.publish") && !can(actor, "admin.open")) {
    throw new AppError("forbidden", "cannot list media");
  }
  const q: Record<string, unknown> = {
    organization_id: new mongoose.Types.ObjectId(actor.organization_id),
    status: { $ne: "deleted" },
  };
  if (opts.kind) q.kind = opts.kind;
  if (opts.status) q.status = opts.status;
  if (opts.visibility) q.visibility = opts.visibility;
  if (opts.cursor) q._id = { $lt: new mongoose.Types.ObjectId(opts.cursor) };
  const limit = Math.min(100, Math.max(1, opts.limit ?? 24));
  const rows = await MediaAsset.find(q).sort({ _id: -1 }).limit(limit + 1).lean<MediaAssetDoc[]>();
  const next_cursor = rows.length > limit ? rows[limit - 1]._id.toString() : null;
  return { items: rows.slice(0, limit), next_cursor };
}

export async function publicVideos(organization_id: string): Promise<MediaAssetDoc[]> {
  return MediaAsset.find({
    organization_id: new mongoose.Types.ObjectId(organization_id),
    kind: "video",
    status: "ready",
    visibility: "public",
    "provider.ready": true,
  })
    .sort({ _id: -1 })
    .limit(50)
    .lean<MediaAssetDoc[]>();
}

// Public photo library — surfaces assets uploaded through /admin/media that
// an editor marked `visibility: public`. Without this, a standalone photo
// upload has no public viewing surface unless it is attached to an
// accomplishment, report, or social post.
export async function publicPhotos(
  organization_id: string,
  opts: { limit?: number; cursor?: string | null } = {}
): Promise<{ items: MediaAssetDoc[]; next_cursor: string | null }> {
  const q: Record<string, unknown> = {
    organization_id: new mongoose.Types.ObjectId(organization_id),
    kind: "photo",
    status: "ready",
    visibility: "public",
  };
  if (opts.cursor) q._id = { $lt: new mongoose.Types.ObjectId(opts.cursor) };
  const limit = Math.min(60, Math.max(1, opts.limit ?? 48));
  const rows = await MediaAsset.find(q)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean<MediaAssetDoc[]>();
  const next_cursor = rows.length > limit ? rows[limit - 1]._id.toString() : null;
  return { items: rows.slice(0, limit), next_cursor };
}

export async function markProviderReady(asset_id: string, playback_id: string | null): Promise<void> {
  await MediaAsset.updateOne(
    { _id: new mongoose.Types.ObjectId(asset_id) },
    {
      $set: {
        "provider.ready": true,
        "provider.playback_id": playback_id,
        status: "ready",
      },
    }
  );
}

// Idempotent cleanup helper for orphaned uploads — called by the cleanup job.
export async function sweepOrphans(olderThanMs: number): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const rows = await MediaAsset.find({
    status: "uploading",
    created_at: { $lt: cutoff },
    "upload.multipart_upload_id": { $ne: null },
  }).limit(50);
  for (const r of rows) {
    try {
      if (r.upload.multipart_upload_id) {
        await abortMultipartUpload(r.bucket, r.key, r.upload.multipart_upload_id);
      }
      r.status = "deleted";
      r.deleted_at = new Date();
      await r.save();
    } catch (err) {
      log.warn({ id: r._id.toString(), err: (err as Error).message }, "media.sweep_failed");
    }
  }
  return rows.length;
}

