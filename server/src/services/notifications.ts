import mongoose from "mongoose";
import {
  Accomplishment,
  EmailDelivery,
  Notification,
  Project,
  SupporterProfile,
  User,
  type NotificationTopic,
} from "@/models/index.js";
import { env } from "@/config/env.js";
import { log } from "@/util/log.js";
import { enqueue } from "./outbox.js";
import { listFollowerIds } from "./follows.js";

// ============================================================================
// Fan-out — called by the worker when an accomplishment publishes. One
// in-app Notification row per follower (unique on dedup_key), plus one
// EmailDelivery queued per follower whose prefs say so.
//
// The worker leases this task; multiple worker instances claim different
// outbox events, so a single `notification.fanout_published_accomplishment`
// event is executed by exactly one worker, inside a single transaction.
// ============================================================================

export async function fanoutAccomplishmentPublished(input: {
  organization_id: string;
  accomplishment_id: string;
}): Promise<{ fanned_out: number; emails_queued: number }> {
  const orgId = new mongoose.Types.ObjectId(input.organization_id);
  const accId = new mongoose.Types.ObjectId(input.accomplishment_id);

  const acc = await Accomplishment.findOne({ _id: accId, organization_id: orgId }).lean();
  if (!acc || acc.state !== "published" || !acc.public_id) {
    log.warn({ id: input.accomplishment_id }, "fanout.not_published");
    return { fanned_out: 0, emails_queued: 0 };
  }

  const project = await Project.findById(acc.project_id).lean();
  if (!project) return { fanned_out: 0, emails_queued: 0 };

  const followerIds = await listFollowerIds(orgId, project._id);
  if (followerIds.length === 0) return { fanned_out: 0, emails_queued: 0 };

  const url = `${env.PUBLIC_SITE_URL.replace(/\/$/, "")}/accomplishments/${acc.public_id}`;
  const topic: NotificationTopic = "accomplishment_published";
  const title = `${project.name}: ${acc.title}`;
  const body = acc.summary;

  // Batching to keep each unit of work small — 100 users at a time.
  const BATCH = 100;
  let fanned = 0;
  let queuedEmails = 0;
  for (let i = 0; i < followerIds.length; i += BATCH) {
    const slice = followerIds.slice(i, i + BATCH);
    const profiles = await SupporterProfile.find({
      organization_id: orgId,
      user_id: { $in: slice },
    }).lean();
    const prefsByUser = new Map(profiles.map((p) => [p.user_id.toString(), p]));

    // In-app notifications: unique on (user_id, dedup_key).
    const inAppOps = slice
      .filter((uid) => {
        const p = prefsByUser.get(uid.toString());
        if (!p) return true; // staff user following — no profile; still notify in-app
        if (p.prefs.unsubscribed_all) return false;
        if (!p.prefs.channels.in_app) return false;
        return p.prefs.accomplishment_published !== "off";
      })
      .map((uid) => ({
        updateOne: {
          filter: { user_id: uid, dedup_key: `acc:${acc.public_id}` },
          update: {
            $setOnInsert: {
              organization_id: orgId,
              user_id: uid,
              topic,
              title,
              body,
              url,
              dedup_key: `acc:${acc.public_id}`,
              read_at: null,
              email_delivery_id: null,
              created_at: new Date(),
            },
          },
          upsert: true,
        },
      }));
    if (inAppOps.length > 0) {
      const r = await Notification.bulkWrite(inAppOps, { ordered: false });
      fanned += r.upsertedCount ?? 0;
    }

    // Email deliveries: unique on (org, idempotency_key).
    const emailOps = await buildEmailOps(orgId, slice, prefsByUser, acc, project, topic, url);
    if (emailOps.length > 0) {
      const r = await EmailDelivery.bulkWrite(emailOps, { ordered: false });
      queuedEmails += r.upsertedCount ?? 0;
    }
  }

  // Enqueue a worker tick per queued batch — the dedicated email worker
  // will scan `queued` rows and send; we also seed a single scan trigger.
  await enqueue({
    organization_id: orgId,
    topic: "email.scan_queue",
    payload: { reason: "accomplishment_published", accomplishment_id: input.accomplishment_id },
  });

  return { fanned_out: fanned, emails_queued: queuedEmails };
}

async function buildEmailOps(
  orgId: mongoose.Types.ObjectId,
  user_ids: mongoose.Types.ObjectId[],
  prefsByUser: Map<string, { prefs: { unsubscribed_all: boolean; channels: { email: boolean }; accomplishment_published: string } }>,
  acc: { _id: mongoose.Types.ObjectId; public_id: string | null; title: string; summary: string },
  project: { name: string },
  topic: NotificationTopic,
  url: string
): Promise<Array<{ updateOne: { filter: Record<string, unknown>; update: Record<string, unknown>; upsert: boolean } }>> {
  const users = await User.find({ _id: { $in: user_ids }, email_verified_at: { $ne: null } })
    .select({ _id: 1, email: 1, display_name: 1 })
    .lean();
  const ops: Array<{ updateOne: { filter: Record<string, unknown>; update: Record<string, unknown>; upsert: boolean } }> = [];
  for (const u of users) {
    const p = prefsByUser.get(u._id.toString());
    // No profile => staff user, which we treat as opted-in to transactional
    // notifications only. Skip for marketing-ish "project update" emails,
    // but allow accomplishment_published for staff following their own
    // projects.
    if (p) {
      if (p.prefs.unsubscribed_all) continue;
      if (!p.prefs.channels.email) continue;
      if (p.prefs.accomplishment_published === "off") continue;
      if (p.prefs.accomplishment_published !== "immediate") continue;
    }
    const idemp = `fanout-${acc.public_id ?? acc._id.toString()}-${u._id.toString()}`;
    ops.push({
      updateOne: {
        filter: { organization_id: orgId, idempotency_key: idemp },
        update: {
          $setOnInsert: {
            organization_id: orgId,
            user_id: u._id,
            to_email: u.email,
            template: "accomplishment_published",
            idempotency_key: idemp,
            subject: `${project.name}: ${acc.title}`,
            payload: {
              display_name: u.display_name,
              project_name: project.name,
              accomplishment_title: acc.title,
              summary: acc.summary,
              url,
              topic,
            },
            status: "queued",
            attempts: 0,
            created_at: new Date(),
            updated_at: new Date(),
          },
        },
        upsert: true,
      },
    });
  }
  return ops;
}

// ---- Self APIs -------------------------------------------------------------

export async function listMyNotifications(
  user_id: string,
  opts: { unread_only?: boolean; limit?: number; cursor?: string }
): Promise<{ items: Array<{ _id: string; topic: string; title: string; body: string; url: string | null; read_at: string | null; created_at: string }>; next_cursor: string | null }> {
  const q: Record<string, unknown> = { user_id: new mongoose.Types.ObjectId(user_id) };
  if (opts.unread_only) q.read_at = null;
  if (opts.cursor) q._id = { $lt: new mongoose.Types.ObjectId(opts.cursor) };
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
  const items = await Notification.find(q).sort({ _id: -1 }).limit(limit + 1).lean();
  const next_cursor = items.length > limit ? items[limit - 1]!._id.toString() : null;
  return {
    items: items.slice(0, limit).map((n) => ({
      _id: n._id.toString(),
      topic: n.topic,
      title: n.title,
      body: n.body,
      url: n.url,
      read_at: n.read_at ? n.read_at.toISOString() : null,
      created_at: n.created_at.toISOString(),
    })),
    next_cursor,
  };
}

export async function markRead(user_id: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await Notification.updateMany(
    {
      _id: { $in: ids.map((x) => new mongoose.Types.ObjectId(x)) },
      user_id: new mongoose.Types.ObjectId(user_id),
      read_at: null,
    },
    { $set: { read_at: new Date() } }
  );
}

export async function markAllRead(user_id: string): Promise<void> {
  await Notification.updateMany(
    { user_id: new mongoose.Types.ObjectId(user_id), read_at: null },
    { $set: { read_at: new Date() } }
  );
}

export async function unreadCount(user_id: string): Promise<number> {
  return Notification.countDocuments({
    user_id: new mongoose.Types.ObjectId(user_id),
    read_at: null,
  });
}

