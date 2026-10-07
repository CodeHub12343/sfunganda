import mongoose from "mongoose";
import { log } from "@/util/log.js";
import { env } from "@/config/env.js";
import {
  Accomplishment,
  ConsentRecord,
  MediaAsset,
  MediaLink,
  SocialConnection,
  SocialPost,
  type SocialConnectionDoc,
} from "@/models/index.js";
import { enqueue } from "../outbox.js";
import { getPublisher } from "./publishers.js";
import { liveAccessToken } from "./connections.js";

// =============================================================================
// Fan-out logic. Called from the `social.fanout_accomplishment_published`
// outbox handler. For each video media_asset on the accomplishment that
// has `social` consent, enqueue ONE `social.post` per active
// connection — one job per (video, platform).
//
// Consent model (§19.3): a video with `contains_minors=true` MUST have
// a linked ConsentRecord whose `scope.social === true`. Videos without
// minors still need an org-level flag to be shared externally — we
// model that with a special "org:social" subject identifier so a single
// consent row can enable or disable the organisation's own content.
// =============================================================================

export async function fanOutAccomplishment(args: {
  organization_id: mongoose.Types.ObjectId;
  accomplishment_id: mongoose.Types.ObjectId;
}): Promise<{ enqueued: number; skipped: number }> {
  if (!env.SOCIAL_ENABLED) {
    log.info({ ...args }, "social.fanout.disabled");
    return { enqueued: 0, skipped: 0 };
  }
  const acc = await Accomplishment.findOne({
    _id: args.accomplishment_id,
    organization_id: args.organization_id,
  }).lean();
  if (!acc || acc.state !== "published") {
    return { enqueued: 0, skipped: 0 };
  }

  // Pull every video on the accomplishment.
  const assets = await MediaAsset.find({
    _id: { $in: acc.media_asset_ids },
    organization_id: args.organization_id,
    kind: "video",
    status: "ready",
    visibility: "public",
  }).lean();
  if (assets.length === 0) return { enqueued: 0, skipped: 0 };

  const connections = (await SocialConnection.find({
    organization_id: args.organization_id,
    status: "active",
  }).lean()) as SocialConnectionDoc[];
  if (connections.length === 0) return { enqueued: 0, skipped: 0 };

  const caption = buildCaption(acc.title, acc.summary);
  let enqueued = 0;
  let skipped = 0;

  for (const asset of assets) {
    const hasSocialConsent = await consentAllowsSocial(args.organization_id, asset);
    for (const conn of connections) {
      const idempotency_key = `social:${acc._id.toString()}:${asset._id.toString()}:${conn._id.toString()}`;
      if (!hasSocialConsent) {
        // Record the skip in the social_posts table so the admin screen
        // can show it. One row per (accomplishment, media, connection),
        // created via upsert so a replay doesn't duplicate.
        await SocialPost.updateOne(
          { organization_id: args.organization_id, idempotency_key },
          {
            $setOnInsert: {
              organization_id: args.organization_id,
              accomplishment_id: acc._id,
              media_asset_id: asset._id,
              connection_id: conn._id,
              platform: conn.platform,
              caption,
              idempotency_key,
            },
            $set: { state: "skipped", skip_reason: "no social consent" },
          },
          { upsert: true }
        );
        skipped++;
        continue;
      }
      let row;
      try {
        row = await SocialPost.create({
          organization_id: args.organization_id,
          accomplishment_id: acc._id,
          media_asset_id: asset._id,
          connection_id: conn._id,
          platform: conn.platform,
          caption,
          state: "queued",
          idempotency_key,
        });
      } catch (err) {
        if ((err as { code?: number }).code === 11000) {
          const existing = await SocialPost.findOne({
            organization_id: args.organization_id,
            idempotency_key,
          }).lean();
          if (existing && (existing.state === "posted" || existing.state === "posting")) continue;
          row = await SocialPost.findOneAndUpdate(
            { organization_id: args.organization_id, idempotency_key },
            { $set: { state: "queued", last_error: null } },
            { new: true }
          );
        } else {
          throw err;
        }
      }
      if (!row) continue;
      await enqueue({
        organization_id: args.organization_id,
        topic: "social.post",
        payload: { post_id: row._id.toString() },
      });
      enqueued++;
    }
  }
  return { enqueued, skipped };
}

async function consentAllowsSocial(
  organization_id: mongoose.Types.ObjectId,
  asset: { _id: mongoose.Types.ObjectId }
): Promise<boolean> {
  // Any linked ConsentRecord takes precedence — if there is one, it must
  // explicitly cover the `social` scope and be unrevoked/unexpired.
  const consentLinks = await MediaLink.find({
    organization_id,
    asset_id: asset._id,
    target: "consent_record",
  }).lean();
  if (consentLinks.length > 0) {
    const consents = await ConsentRecord.find({
      _id: { $in: consentLinks.map((l) => l.target_id) },
      organization_id,
      revoked_at: null,
    }).lean();
    for (const c of consents) {
      if (!c.scope.social) continue;
      if (c.scope.expires_at && c.scope.expires_at < new Date()) continue;
      return true;
    }
    return false;
  }
  // No linked consent — fall back to an org-level default. Operators
  // create a single ConsentRecord with subject_identifier "org:social"
  // and scope.social=true to opt the organisation's content into
  // cross-posting; without it we refuse.
  const org = await ConsentRecord.findOne({
    organization_id,
    subject_identifier: "org:social",
    revoked_at: null,
  }).lean();
  return Boolean(org?.scope.social);
}

function buildCaption(title: string, summary: string): string {
  const t = (title ?? "").trim();
  const s = (summary ?? "").trim();
  const body = s && s !== t ? `${t}\n\n${s}` : t;
  return body.slice(0, 2000);
}

// --- Worker tick --------------------------------------------------------------

export type SocialPostResult = { posted: boolean; retry: boolean; terminal: boolean; error_message?: string };

export async function processSocialPost(post_id: string): Promise<SocialPostResult> {
  const id = new mongoose.Types.ObjectId(post_id);
  const post = await SocialPost.findOneAndUpdate(
    { _id: id, state: "queued" },
    { $set: { state: "posting" }, $inc: { attempts: 1 } },
    { new: true }
  );
  if (!post) {
    const existing = await SocialPost.findById(id).lean();
    if (existing?.state === "posted") return { posted: true, retry: false, terminal: true };
    return { posted: false, retry: false, terminal: true };
  }

  const conn = (await SocialConnection.findOne({
    _id: post.connection_id,
    organization_id: post.organization_id,
  })) as unknown as SocialConnectionDoc | null;
  if (!conn || conn.status !== "active") {
    post.state = "skipped";
    post.skip_reason = "connection revoked";
    await post.save();
    return { posted: false, retry: false, terminal: true };
  }

  const asset = await MediaAsset.findOne({
    _id: post.media_asset_id,
    organization_id: post.organization_id,
  }).lean();
  if (!asset) {
    post.state = "failed";
    post.last_error = "media asset missing";
    await post.save();
    return { posted: false, retry: false, terminal: true };
  }
  // Resolve the public playback URL. For Cloudflare Stream we use the
  // provider's download/HLS URL; for everything else we use the public
  // derivative URL. The publisher takes it from here.
  const videoUrl = resolveVideoUrl(asset);
  if (!videoUrl) {
    post.state = "failed";
    post.last_error = "no playback url";
    await post.save();
    return { posted: false, retry: false, terminal: true };
  }

  const token = await liveAccessToken(conn);
  if (!token) {
    post.state = "failed";
    post.last_error = "no access token";
    await post.save();
    return { posted: false, retry: false, terminal: true };
  }

  const publisher = getPublisher(conn.platform);
  const result = await publisher.publish(conn, {
    video_url: videoUrl,
    caption: post.caption,
    channel_id: conn.channel_id,
  }, token);

  if (result.ok) {
    post.state = "posted";
    post.external_id = result.external_id;
    post.external_url = result.external_url;
    post.last_error = null;
    await post.save();
    return { posted: true, retry: false, terminal: true };
  }

  // Failure branches — terminal vs retryable.
  const terminal =
    result.error_code === "policy_rejected" ||
    (result.error_code === "invalid_grant" && !result.refresh_needed) ||
    post.attempts >= env.SOCIAL_MAX_ATTEMPTS;
  post.state = terminal ? "failed" : "queued";
  post.last_error = `${result.error_code}: ${result.error_message}`.slice(0, 500);
  await post.save();

  // Invalid-grant → mark the connection in error so the admin screen
  // tells the operator to reconnect. The failure is isolated — the
  // accomplishment stays published (§14.7).
  if (result.error_code === "invalid_grant") {
    await SocialConnection.updateOne(
      { _id: conn._id },
      { $set: { status: "error", last_error: result.error_message } }
    );
  }
  return { posted: false, retry: !terminal, terminal, error_message: result.error_message };
}

function resolveVideoUrl(asset: {
  provider?: { name?: string | null; asset_id?: string | null } | null;
  key?: string;
}): string | null {
  if (asset.provider?.name === "stream" && asset.provider.asset_id) {
    return `https://videodelivery.net/${asset.provider.asset_id}/downloads/default.mp4`;
  }
  if (env.R2_PUBLIC_DERIVATIVES_URL && asset.key) {
    return `${env.R2_PUBLIC_DERIVATIVES_URL.replace(/\/$/, "")}/${asset.key}`;
  }
  return null;
}

// --- Operator-triggered retry -----------------------------------------------

export async function retryPost(args: {
  organization_id: mongoose.Types.ObjectId;
  post_id: string;
  user_id: string;
}): Promise<void> {
  const row = await SocialPost.findOne({
    _id: new mongoose.Types.ObjectId(args.post_id),
    organization_id: args.organization_id,
  });
  if (!row) throw new Error("post not found");
  if (row.state !== "failed" && row.state !== "skipped")
    throw new Error(`cannot retry a ${row.state} post`);
  row.state = "queued";
  row.last_error = null;
  row.skip_reason = null;
  row.retried_by = new mongoose.Types.ObjectId(args.user_id);
  row.retried_at = new Date();
  await row.save();
  await enqueue({
    organization_id: args.organization_id,
    topic: "social.post",
    payload: { post_id: row._id.toString() },
  });
}
