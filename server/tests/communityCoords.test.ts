import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { startTestDB, stopTestDB, clearTestDB } from "./setup.js";
import { Business, Community } from "../src/models/index.js";
import { communityWithCoarseCoords, publicSustainability } from "../src/services/sustainability.js";

// =============================================================================
// Phase 8 testing: "no precise coordinates in any response".
//
// We write a community with precise 7-decimal coordinates. Reading it back
// through the public service must return at most one decimal of precision
// — the schema snaps on save, and the service rounds defensively.
// =============================================================================

describe("community coordinates — coarse only", () => {
  beforeAll(async () => {
    await startTestDB();
  });
  afterAll(async () => {
    await stopTestDB();
  });
  beforeEach(async () => {
    await clearTestDB();
  });

  it("rounds precise coordinates to one decimal on save", async () => {
    const orgId = new mongoose.Types.ObjectId();
    await Community.create({
      organization_id: orgId,
      name: "Nowhere",
      slug: "nowhere",
      region_label: "Central Uganda",
      public_lat: 0.3476543,
      public_lng: 32.5825197,
      status: "active",
    });
    const read = await Community.findOne({ organization_id: orgId, slug: "nowhere" }).lean();
    expect(read!.public_lat).toBe(0.3);
    expect(read!.public_lng).toBe(32.6);
  });

  it("public service never returns more than one decimal of precision", async () => {
    const orgId = new mongoose.Types.ObjectId();
    const c = await Community.create({
      organization_id: orgId,
      name: "Nowhere",
      slug: "nowhere",
      region_label: "Central Uganda",
      public_lat: 0.34765,
      public_lng: 32.58251,
      status: "active",
    });
    void c;
    const data = await communityWithCoarseCoords(orgId, "nowhere");
    expect(data).not.toBeNull();
    const asString = (n: number | null) => (n === null ? "" : n.toString());
    for (const v of [data!.public_lat, data!.public_lng]) {
      // Allowed shapes: integer, one decimal, or negative of either.
      expect(asString(v)).toMatch(/^-?\d+(\.\d)?$/);
    }
  });

  it("public sustainability payload only exposes business_id/project_id — no coordinates ever", async () => {
    const orgId = new mongoose.Types.ObjectId();
    const data = await publicSustainability({ organization_id: orgId });
    // No month entry carries a coordinate field; the shape has only
    // revenue/expense rows.
    for (const m of data.months) {
      expect(Object.keys(m).sort()).toEqual(
        [
          "month",
          "revenue_base_cents",
          "operating_expense_base_cents",
          "ratio",
          "revenue_rows",
          "expense_rows",
        ].sort()
      );
      for (const r of [...m.revenue_rows, ...m.expense_rows]) {
        expect("lat" in (r as Record<string, unknown>)).toBe(false);
        expect("lng" in (r as Record<string, unknown>)).toBe(false);
      }
    }
    void Business; // keep import for future expansion
  });
});
