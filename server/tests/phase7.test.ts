import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { startTestDB, stopTestDB, clearTestDB } from "./setup.js";
import {
  Community,
  Donation,
  EmailDelivery,
  Notification,
  Organization,
  OutboxEvent,
  Project,
  ProjectFollow,
  SupporterProfile,
  User,
} from "../src/models/index.js";
import {
  resendVerification,
  signup,
  updatePreferences,
  verifyEmail,
} from "../src/services/supporters.js";
import {
  followProject,
  listMyFollows,
  unfollowProject,
} from "../src/services/follows.js";
import {
  fanoutAccomplishmentPublished,
  listMyNotifications,
  markAllRead,
  markRead,
  unreadCount,
} from "../src/services/notifications.js";

let orgId: mongoose.Types.ObjectId;
let projectId: mongoose.Types.ObjectId;

async function setup(): Promise<void> {
  await clearTestDB();
  const org = await Organization.create({
    slug: "sfu",
    name: "SFU",
    public_id_prefix: "SFU",
    base_currency: "USD",
  });
  orgId = org._id;
  const comm = await Community.create({
    organization_id: orgId,
    name: "Kampala",
    slug: "kampala",
    region_label: "Uganda",
    status: "active",
  });
  const proj = await Project.create({
    organization_id: orgId,
    community_id: comm._id,
    name: "Clean Water",
    slug: "clean-water",
    summary: "Boreholes",
  });
  projectId = proj._id;
}

async function getVerificationToken(email: string): Promise<string> {
  // The signup flow queues an email with the raw token embedded in the URL.
  const row = await OutboxEvent.findOne({
    topic: "email.send_template",
    "payload.to": email.toLowerCase(),
  }).sort({ _id: -1 });
  if (!row) throw new Error("no verification email queued");
  const url = String((row.payload as { data?: { verify_url?: string } }).data?.verify_url ?? "");
  const m = url.match(/token=([^&]+)/);
  if (!m) throw new Error("no token in url");
  return m[1]!;
}

beforeAll(async () => {
  await startTestDB();
});
afterAll(async () => {
  await stopTestDB();
});

beforeEach(async () => {
  await setup();
});

describe("C8 — enumeration-safe signup", () => {
  const base = {
    display_name: "Jane Donor",
    password: "a-strong-password-1234",
    consent: true as const,
  };

  it("returns the same shape whether the email is new, pending, or verified", async () => {
    // New
    const r1 = await signup({ ...base, email: "new@example.com" });
    expect(r1).toEqual({ ok: true });

    // Second signup — same email, user is still pending.
    const r2 = await signup({ ...base, email: "new@example.com" });
    expect(r2).toEqual({ ok: true });

    // Verify, then try to sign up again.
    const token = await getVerificationToken("new@example.com");
    await verifyEmail(token);
    const r3 = await signup({ ...base, email: "new@example.com" });
    expect(r3).toEqual({ ok: true });
  });

  it("silently drops honeypot submissions", async () => {
    const r = await signup({
      ...base,
      email: "bot@example.com",
      website: "https://spam.example",
    });
    expect(r).toEqual({ ok: true });
    const user = await User.findOne({ email: "bot@example.com" });
    expect(user).toBeNull();
  });

  it("resendVerification returns ok whether or not the email exists", async () => {
    const r1 = await resendVerification("ghost@example.com");
    expect(r1).toEqual({ ok: true });
    await signup({ ...base, email: "real@example.com" });
    const r2 = await resendVerification("real@example.com");
    expect(r2).toEqual({ ok: true });
  });
});

describe("verification links pre-existing donations", () => {
  it("links donations whose donor_email matches the verified account", async () => {
    await Donation.create({
      organization_id: orgId,
      public_id: "DON-2026-00001",
      donor_email: "linked@example.com",
      donor_name: "Linked Donor",
      anonymous: false,
      project_id: null,
      fund_id: new mongoose.Types.ObjectId(),
      source_currency: "USD",
      gross_source_cents: 5000,
      fee_source_cents: 150,
      net_source_cents: 4850,
      base_currency: "USD",
      gross_base_cents: 5000,
      fee_base_cents: 150,
      net_base_cents: 4850,
      fx_rate: null,
      processor: "stripe",
      stripe_charge_id: "ch_test_1",
      recurring: false,
      status: "succeeded",
      received_at: new Date(),
    });
    await signup({
      email: "linked@example.com",
      display_name: "Linked",
      password: "a-strong-password-1234",
      consent: true,
    });
    const token = await getVerificationToken("linked@example.com");
    const r = await verifyEmail(token);
    expect(r.linked_donations).toBe(1);
    const d = await Donation.findOne({ donor_email: "linked@example.com" }).lean();
    expect(d!.supporter_user_id!.toString()).toBe(r.user_id);
  });

  it("rejects expired verification tokens", async () => {
    await signup({
      email: "expired@example.com",
      display_name: "Expired",
      password: "a-strong-password-1234",
      consent: true,
    });
    const token = await getVerificationToken("expired@example.com");
    await User.updateOne({ email: "expired@example.com" }, { $set: { verification_expires_at: new Date(Date.now() - 1000) } });
    await expect(verifyEmail(token)).rejects.toMatchObject({ code: "unauthorized" });
  });
});

describe("follows + SELF-only invariants", () => {
  async function makeVerifiedUser(email: string): Promise<string> {
    await signup({
      email,
      display_name: email.split("@")[0]!,
      password: "a-strong-password-1234",
      consent: true,
    });
    const token = await getVerificationToken(email);
    const r = await verifyEmail(token);
    return r.user_id;
  }

  it("follows and unfollows a project idempotently", async () => {
    const uid = await makeVerifiedUser("alice@example.com");
    await followProject(uid, orgId.toString(), projectId.toString());
    await followProject(uid, orgId.toString(), projectId.toString()); // idempotent
    const follows = await listMyFollows(uid, orgId.toString());
    expect(follows.length).toBe(1);
    await unfollowProject(uid, orgId.toString(), projectId.toString());
    const after = await listMyFollows(uid, orgId.toString());
    expect(after.length).toBe(0);
  });

  it("listMyFollows never leaks another user's follows", async () => {
    const alice = await makeVerifiedUser("alice2@example.com");
    const bob = await makeVerifiedUser("bob@example.com");
    await followProject(alice, orgId.toString(), projectId.toString());
    const bobFollows = await listMyFollows(bob, orgId.toString());
    expect(bobFollows.length).toBe(0);
  });

  it("rejects an attempted follow against a project in another organization", async () => {
    const otherOrg = await Organization.create({
      slug: "other",
      name: "Other",
      public_id_prefix: "OTH",
      base_currency: "USD",
    });
    const uid = await makeVerifiedUser("carol@example.com");
    // Passing the other org's id with the primary project should fail.
    await expect(
      followProject(uid, otherOrg._id.toString(), projectId.toString())
    ).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("preference matrix drives notification fan-out", () => {
  async function makeVerifiedFollower(email: string): Promise<string> {
    await signup({
      email,
      display_name: email.split("@")[0]!,
      password: "a-strong-password-1234",
      consent: true,
    });
    const token = await getVerificationToken(email);
    const r = await verifyEmail(token);
    await followProject(r.user_id, orgId.toString(), projectId.toString());
    return r.user_id;
  }

  async function publishAccomplishment(public_id: string): Promise<string> {
    const { Accomplishment } = await import("../src/models/index.js");
    const doc = await Accomplishment.create({
      organization_id: orgId,
      public_id,
      project_id: projectId,
      state: "published",
      title: "Well #1",
      summary: "First well drilled.",
      body_markdown: "Details.",
      occurred_on: new Date("2026-02-15"),
      created_by: new mongoose.Types.ObjectId(),
      published_at: new Date(),
      version: 1,
    });
    return doc._id.toString();
  }

  it("delivers an in-app notification to every follower whose prefs permit it", async () => {
    const u1 = await makeVerifiedFollower("fan1@example.com");
    const u2 = await makeVerifiedFollower("fan2@example.com");
    const u3 = await makeVerifiedFollower("fan3@example.com");
    // u2: in-app off; u3: fully unsubscribed.
    await updatePreferences(u2, { prefs: { channels: { in_app: false } } });
    await updatePreferences(u3, { prefs: { unsubscribed_all: true } });

    const accId = await publishAccomplishment("SFU-2026-0001");
    const r = await fanoutAccomplishmentPublished({
      organization_id: orgId.toString(),
      accomplishment_id: accId,
    });
    expect(r.fanned_out).toBe(1);
    const n1 = await Notification.countDocuments({ user_id: new mongoose.Types.ObjectId(u1) });
    const n2 = await Notification.countDocuments({ user_id: new mongoose.Types.ObjectId(u2) });
    const n3 = await Notification.countDocuments({ user_id: new mongoose.Types.ObjectId(u3) });
    expect(n1).toBe(1);
    expect(n2).toBe(0);
    expect(n3).toBe(0);
  });

  it("queues an email once per follower who opted in to immediate email", async () => {
    const u1 = await makeVerifiedFollower("email1@example.com");
    await makeVerifiedFollower("email2@example.com");
    await updatePreferences(u1, {
      prefs: { accomplishment_published: "weekly_digest" }, // not immediate
    });
    const accId = await publishAccomplishment("SFU-2026-0002");
    await fanoutAccomplishmentPublished({
      organization_id: orgId.toString(),
      accomplishment_id: accId,
    });
    const d1 = await EmailDelivery.countDocuments({ to_email: "email1@example.com" });
    const d2 = await EmailDelivery.countDocuments({ to_email: "email2@example.com" });
    expect(d1).toBe(0);
    expect(d2).toBe(1);
  });

  it("fan-out is idempotent: replaying produces no duplicates", async () => {
    await makeVerifiedFollower("dedup@example.com");
    const accId = await publishAccomplishment("SFU-2026-0003");
    await fanoutAccomplishmentPublished({
      organization_id: orgId.toString(),
      accomplishment_id: accId,
    });
    await fanoutAccomplishmentPublished({
      organization_id: orgId.toString(),
      accomplishment_id: accId,
    });
    expect(await Notification.countDocuments({})).toBe(1);
    expect(await EmailDelivery.countDocuments({ template: "accomplishment_published" })).toBe(1);
  });
});

describe("notifications self APIs", () => {
  it("markRead flips only this user's unread rows", async () => {
    const uid = new mongoose.Types.ObjectId();
    const otherUid = new mongoose.Types.ObjectId();
    const n1 = await Notification.create({
      organization_id: orgId,
      user_id: uid,
      topic: "accomplishment_published",
      title: "A",
      dedup_key: "a:1",
    });
    const nOther = await Notification.create({
      organization_id: orgId,
      user_id: otherUid,
      topic: "accomplishment_published",
      title: "B",
      dedup_key: "a:2",
    });
    await markRead(uid.toString(), [n1._id.toString(), nOther._id.toString()]);
    const after1 = await Notification.findById(n1._id).lean();
    const afterOther = await Notification.findById(nOther._id).lean();
    expect(after1!.read_at).not.toBeNull();
    expect(afterOther!.read_at).toBeNull();
  });

  it("unreadCount scopes to self", async () => {
    const uid = new mongoose.Types.ObjectId();
    await Notification.create({
      organization_id: orgId,
      user_id: uid,
      topic: "system",
      title: "x",
      dedup_key: "sys:1",
    });
    await Notification.create({
      organization_id: orgId,
      user_id: new mongoose.Types.ObjectId(),
      topic: "system",
      title: "y",
      dedup_key: "sys:2",
    });
    expect(await unreadCount(uid.toString())).toBe(1);
    await markAllRead(uid.toString());
    expect(await unreadCount(uid.toString())).toBe(0);
  });

  it("listMyNotifications pages by _id cursor", async () => {
    const uid = new mongoose.Types.ObjectId();
    for (let i = 0; i < 5; i++) {
      await Notification.create({
        organization_id: orgId,
        user_id: uid,
        topic: "system",
        title: `t${i}`,
        dedup_key: `sys:p:${i}`,
      });
    }
    const page1 = await listMyNotifications(uid.toString(), { limit: 2 });
    expect(page1.items.length).toBe(2);
    expect(page1.next_cursor).toBeTruthy();
    const page2 = await listMyNotifications(uid.toString(), { limit: 2, cursor: page1.next_cursor! });
    expect(page2.items.length).toBe(2);
    // No overlap.
    const seen = new Set(page1.items.map((i) => i._id));
    for (const i of page2.items) expect(seen.has(i._id)).toBe(false);
  });
});

describe("supporter profile defaults", () => {
  it("creates a supporter_profile on verify with sensible defaults", async () => {
    await signup({
      email: "defaults@example.com",
      display_name: "Default",
      password: "a-strong-password-1234",
      consent: true,
    });
    const token = await getVerificationToken("defaults@example.com");
    const r = await verifyEmail(token);
    const p = await SupporterProfile.findOne({ user_id: new mongoose.Types.ObjectId(r.user_id) }).lean();
    expect(p).not.toBeNull();
    expect(p!.prefs.accomplishment_published).toBe("immediate");
    expect(p!.prefs.channels.email).toBe(true);
    expect(p!.prefs.channels.in_app).toBe(true);
    expect(p!.prefs.unsubscribed_all).toBe(false);
    expect(p!.anonymous_on_wall).toBe(false);
    expect(p!.unsubscribe_token_hash.length).toBeGreaterThan(0);
  });

  // keep ProjectFollow import live for TS strict builds
  void ProjectFollow;
});
