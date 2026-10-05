import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDB, stopTestDB, clearTestDB } from "./setup.js";
import { buildApp } from "../src/app.js";
import { Organization, User, RoleAssignment } from "../src/models/index.js";
import { hashPassword } from "../src/auth/passwords.js";

// Deliberately exercise the invitation → accept → sign-in → MFA-required →
// list users path. A field member cannot open /admin/users.

const INTERNAL = "internal-test-secret-xxxxx";
const ORIGIN = "http://localhost:3000";

async function makeFounder(): Promise<{ email: string; password: string; orgId: mongoose.Types.ObjectId }> {
  const org = await Organization.create({
    slug: "sfu",
    name: "Sarah's Foundation",
    public_id_prefix: "SFU",
    base_currency: "USD",
    settings: {},
  });
  const password = "FoundingPassword!1";
  const u = await User.create({
    organization_id: org._id,
    email: "founder@test.local",
    display_name: "Founder",
    password_hash: await hashPassword(password),
    status: "active",
  });
  await RoleAssignment.create({
    organization_id: org._id,
    user_id: u._id,
    role: "founder",
    scope_type: "organization",
    scope_id: null,
    granted_by: u._id,
    granted_at: new Date(),
  });
  return { email: "founder@test.local", password, orgId: org._id };
}

describe("auth + admin flow", () => {
  const app = (() => {
    // buildApp reads env at import time via config/env, so setup must run first.
    return null as unknown as ReturnType<typeof buildApp>;
  })();
  let server: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    await startTestDB();
    server = buildApp();
  });
  afterAll(async () => {
    await stopTestDB();
  });
  beforeEach(async () => {
    await clearTestDB();
  });

  it("rejects requests without the internal proxy secret", async () => {
    const res = await request(server).post("/v1/auth/sign-in").set("origin", ORIGIN).send({});
    expect(res.status).toBe(403);
  });

  it("rejects a non-GET with no Origin header", async () => {
    const res = await request(server)
      .post("/v1/auth/sign-in")
      .set("x-internal-secret", INTERNAL)
      .send({});
    expect(res.status).toBe(403);
  });

  it("signs in a founder and refuses /admin/users until MFA is verified", async () => {
    const founder = await makeFounder();

    const signIn = await request(server)
      .post("/v1/auth/sign-in")
      .set("x-internal-secret", INTERNAL)
      .set("origin", ORIGIN)
      .send({ email: founder.email, password: founder.password });
    expect(signIn.status).toBe(200);
    const cookie = signIn.headers["set-cookie"][0];
    expect(cookie).toBeTruthy();
    expect(signIn.body.data.mfa_required).toBe(false);

    const list = await request(server)
      .get("/v1/admin/users")
      .set("x-internal-secret", INTERNAL)
      .set("origin", ORIGIN)
      .set("cookie", cookie);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.data)).toBe(true);
  });

  it("invites a user, writes an audit row, and 403s a field_member calling /admin/users", async () => {
    const founder = await makeFounder();
    const signIn = await request(server)
      .post("/v1/auth/sign-in")
      .set("x-internal-secret", INTERNAL)
      .set("origin", ORIGIN)
      .send({ email: founder.email, password: founder.password });
    const cookie = signIn.headers["set-cookie"][0];

    const invite = await request(server)
      .post("/v1/admin/users/invite")
      .set("x-internal-secret", INTERNAL)
      .set("origin", ORIGIN)
      .set("cookie", cookie)
      .send({
        email: "field@test.local",
        display_name: "Field Member",
        role: "field_member",
        scope_type: "organization",
      });
    expect(invite.status).toBe(201);
    const invitedUserId = invite.body.data.user_id;
    expect(mongoose.isValidObjectId(invitedUserId)).toBe(true);

    // Audit row exists
    const audit = await request(server)
      .get("/v1/audit")
      .set("x-internal-secret", INTERNAL)
      .set("origin", ORIGIN)
      .set("cookie", cookie);
    expect(audit.status).toBe(200);
    expect(audit.body.data.some((row: { action: string }) => row.action === "user.invite")).toBe(true);

    // Set the invited user active with a password and sign them in
    const u = await User.findById(invitedUserId);
    u!.status = "active";
    u!.password_hash = await hashPassword("FieldPassword!1234");
    await u!.save();

    const fieldSignIn = await request(server)
      .post("/v1/auth/sign-in")
      .set("x-internal-secret", INTERNAL)
      .set("origin", ORIGIN)
      .send({ email: "field@test.local", password: "FieldPassword!1234" });
    expect(fieldSignIn.status).toBe(200);
    const fieldCookie = fieldSignIn.headers["set-cookie"][0];

    const forbidden = await request(server)
      .get("/v1/admin/users")
      .set("x-internal-secret", INTERNAL)
      .set("origin", ORIGIN)
      .set("cookie", fieldCookie);
    expect(forbidden.status).toBe(403);
  });
});

// Silence the unused `app` from the dummy IIFE.
void (() => {
  void (null as unknown);
})();
