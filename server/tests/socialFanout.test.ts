import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { startTestDB, stopTestDB, clearTestDB } from "./setup.js";
import {
  Accomplishment,
  Community,
  ConsentRecord,
  MediaAsset,
  MediaLink,
  Organization,
  Project,
  SocialConnection,
  SocialPost,
} from "../src/models/index.js";
import { fanOutAccomplishment, processSocialPost } from "../src/services/social/fanout.js";
import { setPublishersForTests, type SocialPublisher } from "../src/services/social/publishers.js";
import { encryptToken, generateKeyBase64 } from "../src/services/socialTokens.js";

// Phase 12 — fan-out + processor.
// We stub publishers for determinism and set SOCIAL_ENABLED + SOCIAL_TOKEN_KEY
// at the module top-level so the env validator accepts them.

process.env.SOCIAL_ENABLED = "true";
process.env.SOCIAL_TOKEN_KEY = generateKeyBase64();

let orgId: mongoose.Types.ObjectId;
let acc: { _id: mongoose.Types.ObjectId };

async function stubGood(externalId = "ext-ok"): Promise<SocialPublisher> {
  return {
    platform: "youtube",
    configured: true,
    scopes: [],
    async publish() {
      return { ok: true, external_id: externalId, external_url: `https://ex/${externalId}` };
    },
  };
}

async function stubFail(code: "invalid_grant" | "transient" | "policy_rejected", refresh = false): Promise<SocialPublisher> {
  return {
    platform: "youtube",
    configured: true,
    scopes: [],
    async publish() {
      return { ok: false, error_code: code, error_message: `stub ${code}`, refresh_needed: refresh };
    },
  };
}

beforeAll(async () => {
  await startTestDB();
});
afterAll(async () => {
  await stopTestDB();
  setPublishersForTests(null);
});
beforeEach(async () => {
  await clearTestDB();
  setPublishersForTests(null);
  const org = await Organization.create({
    slug: "sfu",
    name: "SFU",
    public_id_prefix: "SFU",
    base_currency: "USD",
  });
  orgId = org._id;
  const community = await Community.create({
    organization_id: orgId,
    name: "K",
    slug: "k",
    region_label: "UG",
  });
  const project = await Project.create({
    organization_id: orgId,
    community_id: community._id,
    name: "P",
    slug: "p",
    summary: "s",
  });
  const asset = await MediaAsset.create({
    organization_id: orgId,
    kind: "video",
    status: "ready",
    visibility: "public",
    bucket: "test",
    key: "video.mp4",
    bytes: 100,
    mime_declared: "video/mp4",
    mime_detected: "video/mp4",
    provider: { name: "stream", asset_id: "stream-1", playback_id: "pb-1", ready: true },
    upload: { multipart_upload_id: null, parts_received: 0 },
    scan: { status: "clean", signature: null, at: new Date() },
    flags: [],
    original_filename: "clip.mp4",
  });
  const accDoc = await Accomplishment.create({
    organization_id: orgId,
    project_id: project._id,
    title: "Update",
    summary: "Summary",
    body_markdown: "Body",
    occurred_on: new Date("2026-10-01"),
    media_asset_ids: [asset._id],
    metrics: [],
    created_by: new mongoose.Types.ObjectId(),
    state: "published",
    public_id: "ACC-2026-0001",
    published_at: new Date(),
  });
  acc = { _id: accDoc._id };

  // Org-level social consent
  await ConsentRecord.create({
    organization_id: orgId,
    subject_identifier: "org:social",
    subject_display: "Organisation default",
    scope: { web: true, social: true, print: false, internal_only: false, expires_at: null },
    minor: false,
    granted_by: new mongoose.Types.ObjectId(),
    granted_at: new Date(),
  });
});

async function seedConnection() {
  return SocialConnection.create({
    organization_id: orgId,
    platform: "youtube",
    channel_id: "chan-1",
    channel_name: "Main channel",
    access_token_ct: encryptToken("access-token"),
    access_token_expires_at: new Date(Date.now() + 60 * 60 * 1000),
    refresh_token_ct: null,
    scopes: [],
    status: "active",
    connected_by: new mongoose.Types.ObjectId(),
    connected_at: new Date(),
  });
}

describe("social fan-out", () => {
  it("enqueues one row per video × connection when consent is in place", async () => {
    await seedConnection();
    const r = await fanOutAccomplishment({ organization_id: orgId, accomplishment_id: acc._id });
    expect(r.enqueued).toBe(1);
    expect(r.skipped).toBe(0);
    const rows = await SocialPost.find({ organization_id: orgId }).lean();
    expect(rows.length).toBe(1);
    expect(rows[0]!.state).toBe("queued");
  });

  it("skips when social consent is missing (no org:social, no linked consent)", async () => {
    await ConsentRecord.updateMany({ subject_identifier: "org:social" }, { $set: { revoked_at: new Date() } });
    await seedConnection();
    const r = await fanOutAccomplishment({ organization_id: orgId, accomplishment_id: acc._id });
    expect(r.enqueued).toBe(0);
    expect(r.skipped).toBe(1);
    const rows = await SocialPost.find({ organization_id: orgId }).lean();
    expect(rows[0]!.state).toBe("skipped");
    expect(rows[0]!.skip_reason).toMatch(/consent/i);
  });

  it("respects a per-media consent link that denies social", async () => {
    const assets = await MediaAsset.find({ organization_id: orgId }).lean();
    const consent = await ConsentRecord.create({
      organization_id: orgId,
      subject_identifier: "child:x",
      subject_display: "Child",
      scope: { web: true, social: false, print: false, internal_only: false, expires_at: null },
      minor: true,
      granted_by: new mongoose.Types.ObjectId(),
      granted_at: new Date(),
    });
    await MediaLink.create({
      organization_id: orgId,
      asset_id: assets[0]!._id,
      target: "consent_record",
      target_id: consent._id,
      role: null,
      order: 0,
      created_by: null,
    });
    await seedConnection();
    const r = await fanOutAccomplishment({ organization_id: orgId, accomplishment_id: acc._id });
    expect(r.enqueued).toBe(0);
    expect(r.skipped).toBe(1);
  });

  it("is idempotent — re-running fan-out on the same accomplishment does not duplicate rows", async () => {
    await seedConnection();
    await fanOutAccomplishment({ organization_id: orgId, accomplishment_id: acc._id });
    await fanOutAccomplishment({ organization_id: orgId, accomplishment_id: acc._id });
    const rows = await SocialPost.find({ organization_id: orgId }).lean();
    expect(rows.length).toBe(1);
  });

  it("processSocialPost on success marks posted with the external url", async () => {
    const conn = await seedConnection();
    const post = await SocialPost.create({
      organization_id: orgId,
      accomplishment_id: acc._id,
      media_asset_id: (await MediaAsset.findOne({ organization_id: orgId }).lean())!._id,
      connection_id: conn._id,
      platform: "youtube",
      caption: "x",
      idempotency_key: "k1",
    });
    setPublishersForTests({ youtube: await stubGood("abc123") });
    const r = await processSocialPost(post._id.toString());
    expect(r.posted).toBe(true);
    const after = await SocialPost.findById(post._id).lean();
    expect(after!.state).toBe("posted");
    expect(after!.external_id).toBe("abc123");
    expect(after!.external_url).toContain("abc123");
  });

  it("invalid_grant marks the row failed AND flips the connection to error (site publication is unaffected)", async () => {
    const conn = await seedConnection();
    const post = await SocialPost.create({
      organization_id: orgId,
      accomplishment_id: acc._id,
      media_asset_id: (await MediaAsset.findOne({ organization_id: orgId }).lean())!._id,
      connection_id: conn._id,
      platform: "youtube",
      caption: "x",
      idempotency_key: "k2",
    });
    setPublishersForTests({ youtube: await stubFail("invalid_grant", false) });
    const r = await processSocialPost(post._id.toString());
    expect(r.terminal).toBe(true);
    const after = await SocialPost.findById(post._id).lean();
    expect(after!.state).toBe("failed");
    const connAfter = await SocialConnection.findById(conn._id).lean();
    expect(connAfter!.status).toBe("error");
    // The accomplishment is untouched — failure isolation (§14.7).
    const accDoc = await Accomplishment.findById(acc._id).lean();
    expect(accDoc!.state).toBe("published");
  });

  it("transient failures re-queue the row for retry", async () => {
    const conn = await seedConnection();
    const post = await SocialPost.create({
      organization_id: orgId,
      accomplishment_id: acc._id,
      media_asset_id: (await MediaAsset.findOne({ organization_id: orgId }).lean())!._id,
      connection_id: conn._id,
      platform: "youtube",
      caption: "x",
      idempotency_key: "k3",
    });
    setPublishersForTests({ youtube: await stubFail("transient") });
    const r = await processSocialPost(post._id.toString());
    expect(r.retry).toBe(true);
    expect(r.terminal).toBe(false);
    const after = await SocialPost.findById(post._id).lean();
    expect(after!.state).toBe("queued");
    expect(after!.attempts).toBe(1);
  });
});
