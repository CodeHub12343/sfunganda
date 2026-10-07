import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { startTestDB, stopTestDB, clearTestDB } from "./setup.js";
import {
  Accomplishment,
  Community,
  IdSequence,
  MetricDefinition,
  MetricEntry,
  Organization,
  Project,
} from "../src/models/index.js";
import { createDraft, transition } from "../src/services/accomplishments.js";
import type { Actor } from "../src/policy/index.js";

let orgId: mongoose.Types.ObjectId;
let projectId: mongoose.Types.ObjectId;
let communityId: mongoose.Types.ObjectId;
let metricId: mongoose.Types.ObjectId;

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
  communityId = community._id;
  const project = await Project.create({
    organization_id: orgId,
    community_id: communityId,
    name: "Clean Water",
    slug: "clean-water",
    summary: "Boreholes in two parishes",
  });
  projectId = project._id;
  const def = await MetricDefinition.create({
    organization_id: orgId,
    key: "wells_built",
    label: "Wells built",
    unit: "wells",
    aggregate: "sum",
    public: true,
  });
  metricId = def._id;
});

async function createDraftFor(user_id: string) {
  return createDraft(mk(user_id, "field_member"), {
    project_id: projectId.toString(),
    title: "First well",
    summary: "Drilled and tested the first well.",
    body_markdown: "Day one notes.",
    occurred_on: "2026-01-15",
    beneficiary_count: 120,
    location_label: "North Parish",
    metrics: [{ definition_id: metricId.toString(), value: 1, unit: "wells" }],
  });
}

async function run(user_id: string, role: string, acc_id: string, t: string, extra: Record<string, unknown> = {}) {
  const d = await Accomplishment.findById(acc_id).lean();
  return transition(mk(user_id, role), acc_id, {
    transition: t as never,
    version: d!.version,
    ...extra,
  });
}

const safeguardingOk = {
  consent_recorded: true,
  no_minor_identifiers: true,
  images_appropriate: true,
  names_scrubbed: true,
};

describe("accomplishment state machine", () => {
  it("walks the happy path: draft → submitted → in_review → approved → published", async () => {
    const draft = await createDraftFor(author);
    await run(author, "field_member", draft._id.toString(), "submit");
    const subAfter = await Accomplishment.findById(draft._id).lean();
    expect(subAfter!.state).toBe("submitted");

    await run(reviewer, "project_manager", draft._id.toString(), "claim_review");
    expect((await Accomplishment.findById(draft._id).lean())!.state).toBe("in_review");

    await run(approver, "director", draft._id.toString(), "approve", {
      safeguarding: safeguardingOk,
    });
    expect((await Accomplishment.findById(draft._id).lean())!.state).toBe("approved");

    const published = await run(publisher, "founder", draft._id.toString(), "publish");
    expect(published.state).toBe("published");
    expect(published.public_id).toMatch(/^ACC-\d{4}-\d{4}$/);

    // Side-effects of publish: project snapshot + metric entries.
    const proj = await Project.findById(projectId).lean();
    expect(proj!.published_accomplishment_count).toBe(1);
    expect(proj!.last_published_at).toBeInstanceOf(Date);
    const entries = await MetricEntry.find({ accomplishment_id: draft._id }).lean();
    expect(entries.length).toBe(1);
    expect(entries[0]!.value).toBe(1);

    // A monotonic public id came from the IdSequence.
    const seq = await IdSequence.findOne({ kind: "accomplishment" }).lean();
    expect(seq!.next_value).toBeGreaterThanOrEqual(2);
  });

  it("blocks approval by the author (C2: separation of duties)", async () => {
    const draft = await createDraftFor(author);
    await run(author, "field_member", draft._id.toString(), "submit");
    await run(reviewer, "project_manager", draft._id.toString(), "claim_review");
    await expect(
      run(author, "director", draft._id.toString(), "approve", { safeguarding: safeguardingOk })
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("blocks publish by the approver (C2: double control)", async () => {
    const draft = await createDraftFor(author);
    await run(author, "field_member", draft._id.toString(), "submit");
    await run(reviewer, "project_manager", draft._id.toString(), "claim_review");
    await run(approver, "director", draft._id.toString(), "approve", {
      safeguarding: safeguardingOk,
    });
    await expect(
      run(approver, "director", draft._id.toString(), "publish")
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("rejects a transition from the wrong source state", async () => {
    const draft = await createDraftFor(author);
    await expect(
      run(publisher, "founder", draft._id.toString(), "publish")
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("requires the safeguarding checklist to approve", async () => {
    const draft = await createDraftFor(author);
    await run(author, "field_member", draft._id.toString(), "submit");
    await run(reviewer, "project_manager", draft._id.toString(), "claim_review");
    await expect(
      run(approver, "director", draft._id.toString(), "approve", { safeguarding: {} })
    ).rejects.toMatchObject({ code: "unprocessable" });
    await expect(
      run(approver, "director", draft._id.toString(), "approve", {
        safeguarding: { ...safeguardingOk, consent_recorded: false },
      })
    ).rejects.toMatchObject({ code: "unprocessable" });
  });

  it("round-trips via changes_requested: in_review → changes_requested → submitted → in_review", async () => {
    const draft = await createDraftFor(author);
    await run(author, "field_member", draft._id.toString(), "submit");
    await run(reviewer, "project_manager", draft._id.toString(), "claim_review");
    await run(reviewer, "project_manager", draft._id.toString(), "request_changes", {
      note: "please add dates",
    });
    expect((await Accomplishment.findById(draft._id).lean())!.state).toBe("changes_requested");
    await run(author, "field_member", draft._id.toString(), "submit");
    await run(reviewer, "project_manager", draft._id.toString(), "claim_review");
    expect((await Accomplishment.findById(draft._id).lean())!.state).toBe("in_review");
  });

  it("rejects with version_conflict on stale version", async () => {
    const draft = await createDraftFor(author);
    const stale = draft.version;
    await run(author, "field_member", draft._id.toString(), "submit");
    await expect(
      transition(mk(reviewer, "project_manager"), draft._id.toString(), {
        transition: "claim_review" as never,
        version: stale,
      })
    ).rejects.toMatchObject({ code: "version_conflict" });
  });

  it("C3: publish is atomic — on IdSequence failure, no state changes", async () => {
    const draft = await createDraftFor(author);
    await run(author, "field_member", draft._id.toString(), "submit");
    await run(reviewer, "project_manager", draft._id.toString(), "claim_review");
    await run(approver, "director", draft._id.toString(), "approve", {
      safeguarding: safeguardingOk,
    });

    // Force a transaction abort by throwing from the IdSequence collection
    // during the publish txn.
    const spy = IdSequence.findOneAndUpdate;
    (IdSequence as unknown as { findOneAndUpdate: unknown }).findOneAndUpdate = () => {
      throw new Error("simulated storage failure");
    };
    try {
      await expect(
        run(publisher, "founder", draft._id.toString(), "publish")
      ).rejects.toThrow();
    } finally {
      (IdSequence as unknown as { findOneAndUpdate: unknown }).findOneAndUpdate = spy;
    }

    const after = await Accomplishment.findById(draft._id).lean();
    expect(after!.state).toBe("approved");
    expect(after!.public_id).toBeNull();
    const entries = await MetricEntry.find({ accomplishment_id: draft._id }).lean();
    expect(entries.length).toBe(0);
    const proj = await Project.findById(projectId).lean();
    expect(proj!.published_accomplishment_count).toBe(0);
  });
});
