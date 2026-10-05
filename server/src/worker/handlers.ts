import mongoose from "mongoose";
import { log } from "@/util/log.js";
import { sendMail, inviteTemplate, volunteerTemplate } from "@/mail/index.js";
import { env } from "@/config/env.js";
import { MediaAsset } from "@/models/index.js";
import {
  allowedMimeForKind,
  readImageDimensions,
  scanBuffer,
  sniffBuffer,
  stripMetadata,
} from "@/services/mediaProcessing.js";
import { bucketName, deleteObject, getObject, putObject } from "@/services/storage.js";
import { sweepOrphans } from "@/services/media.js";

// Topic handlers. Each must be idempotent — the worker guarantees "at least
// once" delivery, so handlers must detect-and-skip repeated work.
export type HandlerCtx = {
  event_id: string;
  organization_id: mongoose.Types.ObjectId;
};

export type HandlerFn = (payload: Record<string, unknown>, ctx: HandlerCtx) => Promise<void>;

const handlers: Record<string, HandlerFn> = {
  async "mail.invite"(payload) {
    const to = String(payload.to);
    const tpl = inviteTemplate({
      invitee_name: String(payload.invitee_name),
      inviter_name: String(payload.inviter_name),
      organization_name: String(payload.organization_name),
      accept_url: String(payload.accept_url),
      expires_at: new Date(String(payload.expires_at)),
    });
    await sendMail({ ...tpl, to });
  },

  async "mail.volunteer_notify"(payload) {
    const to = String(payload.to);
    const tpl = volunteerTemplate({
      full_name: String(payload.full_name),
      email: String(payload.email),
      phone: (payload.phone as string | null) ?? null,
      country: String(payload.country),
      city_region: String(payload.city_region),
      tasks: payload.tasks as string[],
      address: (payload.address as string | null) ?? null,
      note: (payload.note as string | null) ?? null,
    });
    await sendMail({ ...tpl, to });
  },

  async "noop"(payload, ctx) {
    log.info({ ctx, payload }, "noop handler");
  },

  async "media.process"(payload) {
    const id = String(payload.asset_id);
    if (!mongoose.isValidObjectId(id)) return;
    const asset = await MediaAsset.findById(id);
    if (!asset) return;
    if (asset.status === "ready" || asset.status === "deleted" || asset.status === "rejected") return;

    // 1. Fetch the original. Video via provider is handled by the webhook.
    if (asset.kind === "video" && asset.provider.name === "stream") return;
    const original = await getObject(asset.bucket, asset.key);
    if (!original) {
      asset.status = "rejected";
      await asset.save();
      log.warn({ id }, "media.process.no_object");
      return;
    }

    // 2. MIME sniff — reject type confusion.
    const sniffed = sniffBuffer(original);
    asset.mime_detected = sniffed.mime;
    if (!allowedMimeForKind(asset.kind, sniffed.mime)) {
      asset.status = "rejected";
      await asset.save();
      log.warn({ id, declared: asset.mime_declared, detected: sniffed.mime }, "media.process.type_mismatch");
      return;
    }

    // 3. Scan.
    asset.status = "pending_scan";
    await asset.save();
    const scan = await scanBuffer(original);
    asset.scan = { status: scan.ok ? "clean" : "infected", signature: scan.signature, at: new Date() };
    if (!scan.ok) {
      asset.status = "rejected";
      await asset.save();
      // Infected content is deleted from storage immediately.
      await deleteObject(asset.bucket, asset.key).catch(() => undefined);
      log.warn({ id, signature: scan.signature }, "media.process.infected");
      return;
    }

    // 4. Metadata strip (photos). We WRITE the stripped version back to the
    // originals bucket under a `.sanitized` sibling key, and keep the raw
    // original only long enough for operator review (lifecycle rule drops
    // it after 7 days — enforced by R2 lifecycle policy, not here).
    if (asset.kind === "photo") {
      const stripped = stripMetadata(original, sniffed.mime);
      if (stripped.stripped) {
        const sanitizedKey = asset.key.replace(/(\.[^./]+)?$/, ".sanitized$1");
        await putObject(asset.bucket, sanitizedKey, stripped.buf, sniffed.mime);
        asset.key = sanitizedKey;
        asset.exif_stripped = true;
      }
      const dim = readImageDimensions(stripped.buf);
      if (dim) {
        asset.width = dim.width;
        asset.height = dim.height;
      }

      // Publish a public derivative copy if visibility is public.
      if (asset.visibility === "public") {
        const derivKey = asset.key.replace(/^photo\//, "web/");
        const derivBucket = bucketName("derivatives");
        await putObject(derivBucket, derivKey, stripped.buf, sniffed.mime);
        asset.derivatives.push({
          variant: "web",
          key: derivKey,
          bucket: derivBucket,
          bytes: stripped.buf.length,
          width: dim?.width ?? null,
          height: dim?.height ?? null,
          mime: sniffed.mime,
        });
      }
    }

    asset.bytes = original.length;
    asset.status = "ready";
    await asset.save();
  },

  async "media.cleanup"(payload) {
    const id = String(payload.asset_id);
    if (!mongoose.isValidObjectId(id)) return;
    const asset = await MediaAsset.findById(id);
    if (!asset) return;
    // Only wipe storage for deleted or rejected assets.
    if (asset.status !== "deleted" && asset.status !== "rejected") return;
    await deleteObject(asset.bucket, asset.key).catch(() => undefined);
    for (const d of asset.derivatives) {
      await deleteObject(d.bucket, d.key).catch(() => undefined);
    }
  },

  async "media.sweep_orphans"() {
    const n = await sweepOrphans(24 * 60 * 60 * 1000);
    log.info({ swept: n }, "media.sweep");
  },
};

// Allow MAIL recipient env override at handler time (not stored in audit).
export function resolveVolunteerRecipient(): string | null {
  return process.env.VOLUNTEER_NOTIFY_TO ?? null;
}

// Keep env unused warning silenced in this file — env is referenced indirectly
// through mail wrapper.
void env;

export function getHandler(topic: string): HandlerFn | undefined {
  return handlers[topic];
}
