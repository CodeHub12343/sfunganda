import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { startTestDB, stopTestDB, clearTestDB } from "./setup.js";
import {
  Accomplishment,
  AiGeneration,
  Community,
  Organization,
  Project,
} from "../src/models/index.js";
import { draftAccomplishment } from "../src/services/ai/draft.js";
import {
  setProviderForTests,
  type DraftingProvider,
  type GenerateResult,
} from "../src/services/ai/provider.js";
import type { Actor } from "../src/policy/index.js";

// Phase 10 — C9 evaluation fixtures + provider failure fallback.

let orgId: mongoose.Types.ObjectId;
let projectId: mongoose.Types.ObjectId;
const reviewer = "6508f00000000000000a0010";

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
  setProviderForTests(null);
});

beforeEach(async () => {
  await clearTestDB();
  setProviderForTests(null);
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
    name: "Clean Water",
    slug: "cw",
    summary: "Boreholes",
  });
  projectId = project._id;
});

async function mkAcc(body: string) {
  return Accomplishment.create({
    organization_id: orgId,
    project_id: projectId,
    title: "T",
    summary: "S",
    body_markdown: body,
    occurred_on: new Date("2026-02-01"),
    beneficiary_count: 12,
    media_asset_ids: [],
    metrics: [],
    created_by: new mongoose.Types.ObjectId(reviewer),
    state: "in_review",
  });
}

function stubProvider(result: GenerateResult): DraftingProvider {
  return {
    name: result.provider,
    model: result.model,
    enabled: true,
    async generate() {
      return result;
    },
    async translate() {
      return {
        ok: true,
        provider: result.provider,
        model: result.model,
        text: "x",
        tokens: { input: 1, output: 1 },
        latency_ms: 1,
      };
    },
  };
}

describe("drafting pipeline — provider contract", () => {
  it("records a successful generation and returns highlighted spans for invented facts", async () => {
    setProviderForTests(
      stubProvider({
        ok: true,
        provider: "test",
        model: "test-1",
        fields: {
          title: "First well",
          body: "We finished the well on 2026-02-01. 350 families now have water.",
          why_it_matters: "",
          next_steps: "",
          facts_used: ["12 families"],
        },
        tokens: { input: 100, output: 50 },
        latency_ms: 10,
      })
    );
    const acc = await mkAcc("We finished the first well. 12 families now have clean water.");
    const r = await draftAccomplishment(mk(reviewer, "project_manager"), {
      accomplishment_id: acc._id.toString(),
    });
    expect(r.fields).not.toBeNull();
    expect(r.validation.ok).toBe(false);
    expect(r.validation.highlights.some((h) => h.text === "350")).toBe(true);

    const logs = await AiGeneration.find({ organization_id: orgId }).lean();
    expect(logs.length).toBe(1);
    expect(logs[0]!.purpose).toBe("accomplishment.draft");
    expect(logs[0]!.tokens.input).toBe(100);
    expect(logs[0]!.accepted).toBeNull();
  });

  it("falls through on provider timeout and records an error row (fallback for §17.3)", async () => {
    setProviderForTests(
      stubProvider({
        ok: false,
        provider: "test",
        model: "test-1",
        error_code: "timeout",
        error_message: "provider timed out",
        tokens: { input: 0, output: 0 },
        latency_ms: 25_000,
      })
    );
    const acc = await mkAcc("Field report body.");
    const r = await draftAccomplishment(mk(reviewer, "project_manager"), {
      accomplishment_id: acc._id.toString(),
    });
    expect(r.fields).toBeNull();
    expect(r.error_code).toBe("timeout");
    const logs = await AiGeneration.find({ organization_id: orgId }).lean();
    expect(logs.length).toBe(1);
    expect(logs[0]!.error_code).toBe("timeout");
    expect(logs[0]!.output).toBeNull();
  });

  it("masks person names before they reach the provider", async () => {
    const seen: string[] = [];
    setProviderForTests({
      name: "test",
      model: "test-1",
      enabled: true,
      async generate(input) {
        seen.push(input.user);
        return {
          ok: true,
          provider: "test",
          model: "test-1",
          fields: {
            title: "An update",
            body: "A visit took place.",
            why_it_matters: "",
            next_steps: "",
            facts_used: [],
          },
          tokens: { input: 1, output: 1 },
          latency_ms: 1,
        };
      },
      async translate() {
        return {
          ok: true,
          provider: "test",
          model: "test-1",
          text: "",
          tokens: { input: 0, output: 0 },
          latency_ms: 0,
        };
      },
    });
    const acc = await mkAcc("Mary Namusoke visited the parish");
    await draftAccomplishment(mk(reviewer, "project_manager"), {
      accomplishment_id: acc._id.toString(),
    });
    expect(seen[0]).not.toContain("Mary Namusoke");
    expect(seen[0]).toContain("[PERSON_1]");

    const log = await AiGeneration.findOne({ organization_id: orgId }).lean();
    const snap = JSON.stringify(log!.input_snapshot);
    expect(snap).not.toContain("Mary Namusoke");
  });

  it("enforces the daily user cap", async () => {
    setProviderForTests(stubProvider({
      ok: true,
      provider: "test",
      model: "test-1",
      fields: { title: "t", body: "", why_it_matters: "", next_steps: "", facts_used: [] },
      tokens: { input: 1, output: 1 },
      latency_ms: 1,
    }));
    const acc = await mkAcc("hello");
    // Pre-fill the log past the user cap.
    const cap = Number(process.env.AI_DAILY_USER_CAP ?? 60);
    const docs = Array.from({ length: cap }, () => ({
      organization_id: orgId,
      purpose: "accomplishment.draft",
      actor_id: new mongoose.Types.ObjectId(reviewer),
      entity_type: "accomplishment",
      entity_id: acc._id,
      provider: "test",
      model: "test-1",
      input_snapshot: {},
      output: null,
      validation_result: { ok: true, findings: [], highlights: [] },
      accepted: null,
      tokens: { input: 1, output: 1 },
      latency_ms: 1,
      created_at: new Date(),
    }));
    await AiGeneration.insertMany(docs as never);
    await expect(
      draftAccomplishment(mk(reviewer, "project_manager"), { accomplishment_id: acc._id.toString() })
    ).rejects.toMatchObject({ code: "rate_limited" });
  });
});

// Keep vi referenced so TypeScript doesn't drop the import.
void vi;
