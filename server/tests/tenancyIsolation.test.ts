import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { startTestDB, stopTestDB, clearTestDB } from "./setup.js";
import {
  Accomplishment,
  Community,
  Fund,
  LedgerEntry,
  MediaAsset,
  Organization,
  Project,
  VolunteerSignup,
} from "../src/models/index.js";
import { resolveOrgByHost, clearTenantCache } from "../src/services/tenancy.js";

// =============================================================================
// Phase 13 — cross-organisation isolation matrix.
//
// Seeds two independent organisations with their own community,
// project, published accomplishment, media asset, fund, ledger entry,
// and volunteer signup. Then asserts that each tenant-scoped query
// returns ONLY that tenant's rows and that no scan across collections
// leaks across the boundary. The DoD of Phase 13 — "two organisations
// on one deployment with no cross-visibility, proven by tests" — is
// what this file is for.
// =============================================================================

type Seed = {
  org: mongoose.Types.ObjectId;
  slug: string;
  host: string;
  community: mongoose.Types.ObjectId;
  project: mongoose.Types.ObjectId;
  accomplishment: mongoose.Types.ObjectId;
  media_asset: mongoose.Types.ObjectId;
  fund: mongoose.Types.ObjectId;
};

async function seedOrg(args: { slug: string; host: string }): Promise<Seed> {
  const org = await Organization.create({
    slug: args.slug,
    name: `${args.slug} org`,
    public_id_prefix: args.slug.toUpperCase().slice(0, 4),
    base_currency: "USD",
    domains: [args.host],
    branding: {
      display_name: `${args.slug} brand`,
      tagline: "",
      hero_markdown: "",
      accent_color: "#2563eb",
      logo_asset_id: null,
      footer_line: "",
    },
    inter_org: { send_enabled: false, receive_enabled: false, allowed_recipient_slugs: [] },
  });
  const community = await Community.create({
    organization_id: org._id,
    name: `${args.slug} community`,
    slug: `${args.slug}-c`,
    region_label: "UG",
  });
  const project = await Project.create({
    organization_id: org._id,
    community_id: community._id,
    name: `${args.slug} project`,
    slug: `${args.slug}-p`,
    summary: "",
  });
  const accomplishment = await Accomplishment.create({
    organization_id: org._id,
    project_id: project._id,
    title: `${args.slug} update`,
    summary: `${args.slug} summary`,
    body_markdown: "body",
    occurred_on: new Date("2026-01-01"),
    media_asset_ids: [],
    metrics: [],
    created_by: new mongoose.Types.ObjectId(),
    state: "published",
    public_id: `${args.slug.toUpperCase().slice(0, 3)}-2026-0001`,
    published_at: new Date(),
  });
  const media = await MediaAsset.create({
    organization_id: org._id,
    kind: "video",
    status: "ready",
    visibility: "public",
    bucket: "b",
    key: `${args.slug}/v.mp4`,
    bytes: 1,
    mime_declared: "video/mp4",
    mime_detected: "video/mp4",
    provider: { name: null, asset_id: null, playback_id: null, ready: false },
    upload: { multipart_upload_id: null, parts_received: 0 },
    scan: { status: "clean", signature: null, at: new Date() },
    flags: [],
    original_filename: "v.mp4",
  });
  const fund = await Fund.create({
    organization_id: org._id,
    code: `${args.slug.toUpperCase().slice(0, 4)}-GEN`,
    name: "general",
    kind: "general",
    base_currency: "USD",
    balance_cents: 10_000,
    total_in_cents: 10_000,
    total_out_cents: 0,
    restriction: null,
    active: true,
  });
  await LedgerEntry.create({
    organization_id: org._id,
    transaction_id: new mongoose.Types.ObjectId(),
    seq: 1,
    prev_hash: "",
    hash: "aa",
    side: "credit",
    fund_id: fund._id,
    account: "donations_received",
    amount_cents: 10_000,
    base_currency: "USD",
    posted_at: new Date(),
  });
  await VolunteerSignup.create({
    organization_id: org._id,
    full_name: `${args.slug} volunteer`,
    email: `v@${args.host}`,
    country: "UG",
    city_region: "K",
    tasks: ["share"],
    consent: true,
  });
  return {
    org: org._id,
    slug: args.slug,
    host: args.host,
    community: community._id,
    project: project._id,
    accomplishment: accomplishment._id,
    media_asset: media._id,
    fund: fund._id,
  };
}

let A: Seed;
let B: Seed;

beforeAll(async () => {
  await startTestDB();
});
afterAll(async () => {
  await stopTestDB();
});
beforeEach(async () => {
  await clearTestDB();
  clearTenantCache();
  A = await seedOrg({ slug: "aa", host: "a.example.test" });
  B = await seedOrg({ slug: "bb", host: "b.example.test" });
});

describe("Phase 13 — cross-org isolation", () => {
  it("resolves each host to its OWN organisation (not the first row)", async () => {
    const a = await resolveOrgByHost("a.example.test");
    const b = await resolveOrgByHost("b.example.test");
    expect(a!._id.equals(A.org)).toBe(true);
    expect(b!._id.equals(B.org)).toBe(true);
  });

  it("case- and port-insensitive host matching", async () => {
    expect((await resolveOrgByHost("A.example.test:3000"))!._id.equals(A.org)).toBe(true);
  });

  it("returns null for an unmapped host when multiple orgs exist", async () => {
    const r = await resolveOrgByHost("c.example.test");
    expect(r).toBeNull();
  });

  const tenantQueries: Array<{ name: string; run: (orgId: mongoose.Types.ObjectId) => Promise<mongoose.Types.ObjectId[]> }> = [
    {
      name: "communities",
      run: async (o) => (await Community.find({ organization_id: o }).lean()).map((r) => r._id),
    },
    {
      name: "projects",
      run: async (o) => (await Project.find({ organization_id: o }).lean()).map((r) => r._id),
    },
    {
      name: "accomplishments",
      run: async (o) =>
        (await Accomplishment.find({ organization_id: o, state: "published" }).lean()).map((r) => r._id),
    },
    {
      name: "media_assets",
      run: async (o) => (await MediaAsset.find({ organization_id: o, visibility: "public" }).lean()).map((r) => r._id),
    },
    {
      name: "funds",
      run: async (o) => (await Fund.find({ organization_id: o }).lean()).map((r) => r._id),
    },
    {
      name: "ledger_entries",
      run: async (o) => (await LedgerEntry.find({ organization_id: o }).lean()).map((r) => r._id),
    },
    {
      name: "volunteer_signups",
      run: async (o) => (await VolunteerSignup.find({ organization_id: o }).lean()).map((r) => r._id),
    },
  ];

  it("every tenant-scoped collection returns ONLY the tenant's rows", async () => {
    for (const { name, run } of tenantQueries) {
      const inA = (await run(A.org)).map((x) => x.toString());
      const inB = (await run(B.org)).map((x) => x.toString());
      expect(inA.length, `${name} should return rows for A`).toBeGreaterThanOrEqual(1);
      expect(inB.length, `${name} should return rows for B`).toBeGreaterThanOrEqual(1);
      const overlap = inA.filter((x) => inB.includes(x));
      expect(overlap, `${name} rows must not overlap between orgs`).toEqual([]);
    }
  });

  it("a query filtered to org A never surfaces org B's rows across all tenant collections", async () => {
    const bIds = new Set<string>([
      B.org.toString(),
      B.community.toString(),
      B.project.toString(),
      B.accomplishment.toString(),
      B.media_asset.toString(),
      B.fund.toString(),
    ]);
    for (const { name, run } of tenantQueries) {
      const idsA = (await run(A.org)).map((x) => x.toString());
      for (const id of idsA) {
        expect(bIds.has(id), `${name} leaked B id ${id} into A's result`).toBe(false);
      }
    }
  });
});
