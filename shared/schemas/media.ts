import { z } from "zod";
import { nonEmpty, objectId } from "./common.js";

export const mediaKind = z.enum(["photo", "document", "video"]);
export type MediaKind = z.infer<typeof mediaKind>;

export const mediaStatus = z.enum([
  "ticketed",
  "uploading",
  "pending_scan",
  "pending_processing",
  "ready",
  "rejected",
  "deleted",
]);
export type MediaStatus = z.infer<typeof mediaStatus>;

export const mediaVisibility = z.enum(["internal", "public"]);
export type MediaVisibility = z.infer<typeof mediaVisibility>;

export const mediaLinkTarget = z.enum([
  "community",
  "project",
  "accomplishment",
  "user",
  "story",
  "page",
  "consent_record",
]);

export const PHOTO_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;
export const VIDEO_MIME = ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"] as const;
export const DOCUMENT_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const mediaTicketBody = z.object({
  kind: mediaKind,
  mime: z.string().min(3).max(128),
  bytes: z.coerce.number().int().positive(),
  filename: nonEmpty(255),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  visibility: mediaVisibility.default("internal"),
  link: z
    .object({
      target: mediaLinkTarget,
      id: objectId,
      role: z.string().max(32).optional(),
    })
    .optional(),
  alt_text: z.string().max(500).optional(),
  // For video: ask for a Cloudflare Stream direct-upload URL instead of R2.
  via_provider: z.boolean().optional().default(false),
});
export type MediaTicketBody = z.infer<typeof mediaTicketBody>;

export const mediaCompleteBody = z.object({
  asset_id: objectId,
  parts: z
    .array(
      z.object({
        part_number: z.number().int().min(1).max(10_000),
        etag: z.string().min(1).max(256),
      })
    )
    .optional(),
  upload_id: z.string().min(1).max(256).optional(),
  provider_asset_id: z.string().min(1).max(128).optional(),
  bytes_uploaded: z.coerce.number().int().positive().optional(),
});
export type MediaCompleteBody = z.infer<typeof mediaCompleteBody>;

export const mediaFlagBody = z.object({
  reason: z.enum(["unsafe", "offtopic", "copyright", "pii", "other"]),
  note: z.string().max(500).optional(),
});

export const mediaUpdateBody = z.object({
  alt_text: z.string().max(500).optional(),
  caption: z.string().max(2000).optional(),
  visibility: mediaVisibility.optional(),
});

export const consentBody = z.object({
  // The person depicted or whose story is being used. Not an app user —
  // beneficiary PII lives in the private DB; here we store only an opaque
  // identifier plus display name.
  subject_identifier: nonEmpty(128),
  subject_display: nonEmpty(200),
  // Which media the consent attaches to (optional — can precede the upload).
  media_asset_ids: z.array(objectId).max(50).optional(),
  // Scope: how the material may be used.
  scope: z.object({
    web: z.boolean().default(false),
    social: z.boolean().default(false),
    print: z.boolean().default(false),
    internal_only: z.boolean().default(false),
    expires_at: z.string().datetime().optional(),
  }),
  // The signed consent form itself (an uploaded document asset).
  signed_form_asset_id: objectId.optional(),
  // Guardian consent fields for minors (Q2).
  minor: z.boolean().default(false),
  guardian_name: z.string().max(200).optional(),
  guardian_relationship: z.string().max(80).optional(),
  note: z.string().max(2000).optional(),
});
export type ConsentBody = z.infer<typeof consentBody>;
