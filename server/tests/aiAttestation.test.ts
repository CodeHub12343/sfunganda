import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { startTestDB, stopTestDB, clearTestDB } from "./setup.js";
import {
  Accomplishment,
  Community,
  Organization,
  Project,
} from "../src/models/index.js";
import { createDraft, transition } from "../src/services/accomplishments.js";
import type { Actor } from "../src/policy/index.js";

// Phase 10 — Definition of done: "an ai_assisted item cannot publish without
// attestation". The attestation gate hooks on BOTH approve and publish; a
// pre-publish attestation records who did the check and when.

let orgId: mongoose.Types.ObjectId;
let projectId: mongoose.Types.ObjectId;

const author = "6508f00000000000000a0001";
const reviewer = "6508f00000000000000a0002";
const approver = "6508f00000000000000a0003";
const publisher = "6508f00000000000000a0004";

function mk(user_id: string, role: string): Actor {
  return {
    user_id,
    organization_id: orgId.toString(),
    mfa_verified: true,
    assignments: [{ role: role as never, scope_type: "organization", scope_id: null }],
  };
}

beforeAll(async () => {
  await startTestDB();
});
afterAll(async () => {
  await stopTestDB();
});

beforeEach(async () => {
  await clearTestDB();
  const org = await Organization.create({
    slug: "sfu",
    name: "SFU",
    public_id_prefix: "SFU",
    base_currency: "USD",
  });
  orgId = org._id;
  const community = await Community.create({
    organization_id: orgId,
    name: "Kampala",
    slug: "kampala",
    region_label: "Uganda",
  });
  const project = await Project.create({
    organization_id: orgId,
    community_id: community._id,
    name: "Clean Water",
    slug: "clean-water",
    summary: "Boreholes",
  });
  projectId = project._id;
});

const safeguardingOk = {
  consent_recorded: true,
  no_minor_identifiers: true,
  images_appropriate: true,
  names_scrubbed: true,
};

async function run(user_id: string, role: string, acc_id: string, t: string, extra: Record<string, unknown> = {}) {
  const d = await Accomplishment.findById(acc_id).lean();
  return transition(mk(user_id, role), acc_id, {
    transition: t as never,
    version: d!.version,
    ...extra,
  });
}

async function mkDraft(aiAssisted: boolean) {
  const draft = await createDraft(mk(author, "field_member"), {
    project_id: projectId.toString(),
    title: "First well",
    summary: "A clean-water update.",
    body_markdown: "Day one notes.",
    occurred_on: "2026-02-01",
    beneficiary_count: 12,
    location_label: "North Parish",
  });
  if (aiAssisted) {
    await Accomplishment.updateOne({ _id: draft._id }, { $set: { ai_assisted: true } });
  }
  return draft;
}

describe("ai_assisted publish gate", () => {
  it("non-ai_assisted item publishes without an attestation", async () => {
    const draft = await mkDraft(false);
    await run(author, "field_member", draft._id.toString(), "submit");
    await run(reviewer, "project_manager", draft._id.toString(), "claim_review");
    await run(approver, "director", draft._id.toString(), "approve", { safeguarding: safeguardingOk });
    const published = await run(publisher, "founder", draft._id.toString(), "publish");
    expect(published.state).toBe("published");
  });

  it("ai_assisted item cannot be approved without an attestation", async () => {
    const draft = await mkDraft(true);
    await run(author, "field_member", draft._id.toString(), "submit");
    await run(reviewer, "project_manager", draft._id.toString(), "claim_review");
    await expect(
      run(approver, "director", draft._id.toString(), "approve", { safeguarding: safeguardingOk })
    ).rejects.toMatchObject({ code: "unprocessable", fields: { ai_attestation: expect.any(String) } });
  });

  it("ai_assisted item approves and publishes when attestation is set", async () => {
    const draft = await mkDraft(true);
    await run(author, "field_member", draft._id.toString(), "submit");
    await run(reviewer, "project_manager", draft._id.toString(), "claim_review");
    const approved = await run(approver, "director", draft._id.toString(), "approve", {
      safeguarding: safeguardingOk,
      ai_attestation: true,
    });
    expect(approved.state).toBe("approved");
    expect(approved.ai_attestation_by!.toString()).toBe(approver);
    expect(approved.ai_attestation_at).toBeInstanceOf(Date);
    const published = await run(publisher, "founder", draft._id.toString(), "publish");
    expect(published.state).toBe("published");
  });

  it("publish is also guarded when approve somehow lacked attestation", async () => {
    // Simulate corrupted state: ai_assisted set after approve.
    const draft = await mkDraft(false);
    await run(author, "field_member", draft._id.toString(), "submit");
    await run(reviewer, "project_manager", draft._id.toString(), "claim_review");
    await run(approver, "director", draft._id.toString(), "approve", { safeguarding: safeguardingOk });
    await Accomplishment.updateOne(
      { _id: draft._id },
      { $set: { ai_assisted: true, ai_attestation_at: null, ai_attestation_by: null } }
    );
    await expect(
      run(publisher, "founder", draft._id.toString(), "publish")
    ).rejects.toMatchObject({ code: "unprocessable" });
  });
});
