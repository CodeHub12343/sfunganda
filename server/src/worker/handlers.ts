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

  async "notify.review_queue"(payload) {
    // Email staff with the accomplishments.review action that a new item is
    // waiting. We don't dynamically resolve inboxes here — a `REVIEW_NOTIFY_TO`
    // env var carries a comma-separated list configured by ops. In Phase 1's
    // volunteer handler the same convention is already in use.
    const to = (process.env.REVIEW_NOTIFY_TO ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (to.length === 0) {
      log.warn({ payload }, "notify.review_queue.no_recipients");
      return;
    }
    const title = String(payload.title ?? "Untitled");
    const id = String(payload.accomplishment_id ?? "");
    const link = `${env.PUBLIC_SITE_URL.replace(/\/$/, "")}/admin/queue/${id}`;
    const subject = `Review needed: ${title}`;
    const html = `<p>A new accomplishment is awaiting review:</p><p><a href="${link}">${title}</a></p>`;
    for (const rcpt of to) {
      await sendMail({ to: rcpt, subject, html, text: `${subject}\n${link}` });
    }
  },

  async "notify.author_revision"(payload) {
    const authorId = String(payload.author_id ?? "");
    if (!authorId || !mongoose.isValidObjectId(authorId)) return;
    const { User } = await import("@/models/index.js");
    const author = await User.findById(authorId).lean();
    if (!author?.email) return;
    const link = `${env.PUBLIC_SITE_URL.replace(/\/$/, "")}/field/draft/${payload.accomplishment_id}`;
    const subject = "Changes requested on your accomplishment";
    const note = String(payload.note ?? "").slice(0, 2000);
    const html = `<p>A reviewer has requested changes:</p><blockquote>${escapeHtml(note)}</blockquote><p><a href="${link}">Open the draft</a></p>`;
    await sendMail({ to: author.email, subject, html, text: `${subject}\n${note}\n${link}` });
  },

  async "finance.integrity"() {
    const { runIntegrity } = await import("@/services/integrity.js");
    const r = await runIntegrity();
    log.info({ ok: r.ok, reports: r.reports.length }, "finance.integrity.done");
  },

  async "finance.state_changed"(payload) {
    log.info({ payload }, "finance.state_changed");
  },

  async "email.send_template"(payload, ctx) {
    // Enqueues an EmailDelivery (idempotent) and fires immediate send. The
    // scan_queue path handles bulk fan-out; this one services small, latency-
    // sensitive paths (signup verification, receipts).
    const { EmailDelivery } = await import("@/models/index.js");
    const to = String(payload.to ?? "");
    const template = String(payload.template ?? "");
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const idempotency_key = String(payload.idempotency_key ?? `${template}-${to}-${Date.now()}`);
    const subject = subjectFor(template, data);
    const orgId = ctx.organization_id;
    const user_id = payload.user_id ? new mongoose.Types.ObjectId(String(payload.user_id)) : null;
    try {
      await EmailDelivery.create({
        organization_id: orgId,
        user_id,
        to_email: to.toLowerCase(),
        template,
        idempotency_key,
        subject,
        payload: data,
        status: "queued",
        attempts: 1,
      });
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err;
      // Already queued — a replay. Fall through and try sending again.
    }
    const { sendTemplatedEmail } = await import("@/services/emailSender.js");
    try {
      const providerId = await sendTemplatedEmail({ to, subject, template, payload: data });
      await EmailDelivery.updateOne(
        { organization_id: orgId, idempotency_key },
        { $set: { status: "sent", sent_at: new Date(), provider_message_id: providerId, error_message: null } }
      );
    } catch (err) {
      await EmailDelivery.updateOne(
        { organization_id: orgId, idempotency_key },
        { $set: { status: "queued", error_message: (err as Error).message } }
      );
      throw err;
    }
  },

  async "notification.fanout_accomplishment_published"(payload, ctx) {
    const { fanoutAccomplishmentPublished } = await import("@/services/notifications.js");
    const r = await fanoutAccomplishmentPublished({
      organization_id: ctx.organization_id.toString(),
      accomplishment_id: String(payload.accomplishment_id ?? ""),
    });
    log.info(r, "notification.fanout.done");
  },

  async "email.scan_queue"(payload) {
    // Scan the queue for ready-to-send emails. Lease them with
    // findOneAndUpdate so a sibling worker never claims the same row.
    const { EmailDelivery, Organization } = await import("@/models/index.js");
    const { sendTemplatedEmail } = await import("@/services/emailSender.js");
    const now = new Date();
    const MAX_PER_TICK = 50;
    let sent = 0;
    while (sent < MAX_PER_TICK) {
      const row = await EmailDelivery.findOneAndUpdate(
        { status: "queued" },
        { $set: { status: "sending", updated_at: now }, $inc: { attempts: 1 } },
        { new: true, sort: { created_at: 1 } }
      );
      if (!row) break;
      const orgCount = await Organization.countDocuments();
      try {
        const providerId = await sendTemplatedEmail({
          to: row.to_email,
          subject: row.subject,
          template: row.template,
          payload: row.payload as Record<string, unknown>,
        });
        await EmailDelivery.updateOne(
          { _id: row._id },
          { $set: { status: "sent", sent_at: new Date(), provider_message_id: providerId, error_message: null } }
        );
        sent++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown";
        const nextStatus = row.attempts >= 5 ? "failed" : "queued";
        await EmailDelivery.updateOne(
          { _id: row._id },
          { $set: { status: nextStatus, error_message: msg } }
        );
      }
      void orgCount; // keep import live
      void payload;
    }
    log.info({ sent }, "email.scan.done");
  },

  async "cache.revalidate"(payload) {
    const tags = Array.isArray(payload.tags) ? (payload.tags as string[]) : [];
    const base = process.env.REVALIDATE_URL;
    const secret = process.env.REVALIDATE_SECRET;
    if (!base || !secret) {
      log.info({ tags }, "cache.revalidate.dry_run");
      return;
    }
    for (const tag of tags) {
      try {
        const res = await fetch(`${base}?tag=${encodeURIComponent(tag)}`, {
          method: "POST",
          headers: { "x-revalidate-secret": secret },
        });
        if (!res.ok) log.warn({ tag, status: res.status }, "cache.revalidate.failed");
      } catch (err) {
        log.warn({ tag, err: (err as Error).message }, "cache.revalidate.error");
      }
    }
  },
};

function subjectFor(template: string, data: Record<string, unknown>): string {
  switch (template) {
    case "supporter_verify":
      return "Confirm your email — Sarah's Foundation";
    case "supporter_already_registered":
      return "You already have a Sarah's Foundation account";
    case "accomplishment_published":
      return `${String(data.project_name ?? "Sarah's Foundation")}: ${String(data.accomplishment_title ?? "A new update")}`;
    case "donation_receipt":
      return `Thank you for your donation (${String(data.donation_id ?? "")})`;
    default:
      return "Sarah's Foundation";
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
  );
}

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
