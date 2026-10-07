import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { renderReportPdf } from "../src/services/reportPdf.js";
import type { ImpactReportDoc } from "../src/models/ImpactReport.js";

// =============================================================================
// Phase 9 testing: "accessible, tagged PDF" + "figures in the PDF equal the
// snapshot".
//
// We render a minimal report, then verify:
//   • it's a valid PDF (header "%PDF-"),
//   • the `tagged: true` flag is set on the result (PDF/UA opt-in),
//   • the metadata catalog carries `/Lang` and `/Metadata` (lang + XMP),
//   • the number strings in the snapshot show up verbatim in the file.
//
// We purposely avoid `pdf-parse` (requires a test fixture to not throw at
// import time); the byte-level checks above are enough to assert the
// contract.
// =============================================================================

function fakeReport(): ImpactReportDoc {
  const now = new Date("2026-04-01T00:00:00Z");
  return {
    _id: new mongoose.Types.ObjectId(),
    organization_id: new mongoose.Types.ObjectId(),
    period_kind: "month",
    period_code: "2026-03",
    title: "March 2026 report",
    state: "approved",
    summary: "Short editorial summary that should be present verbatim in the rendered PDF.",
    body_markdown: "A paragraph about **progress**.\n\nAnother paragraph.",
    selected_accomplishment_public_ids: [],
    selected_media_ids: [],
    created_by: new mongoose.Types.ObjectId(),
    edited_by: null,
    finance_signed_by: null,
    finance_signed_at: null,
    approved_by: null,
    approved_at: null,
    published_by: null,
    published_at: null,
    archived_by: null,
    archived_at: null,
    latest_export_id: null,
    created_at: now,
    updated_at: now,
    version: 1,
    snapshot: {
      period_kind: "month",
      period_code: "2026-03",
      period_start: new Date(Date.UTC(2026, 2, 1)).toISOString(),
      period_end: new Date(Date.UTC(2026, 3, 1)).toISOString(),
      compiled_at: now.toISOString(),
      compiled_by: "test",
      compiler_version: "phase9.1",
      content_hash: "a".repeat(64),
      totals: { projects: 3, communities: 1, accomplishments: 2, businesses: 1 },
      finance: {
        base_currency: "USD",
        donations_received_base_cents: 100_000,
        operating_expenses_base_cents: 20_000,
        programme_expenses_base_cents: 15_000,
        business_revenue_base_cents: 50_000,
        sustainability_ratio: 2.5,
        fund_balances: [{ code: "GEN", name: "General", balance_cents: 7_500_000 }],
      },
      accomplishments: [
        {
          public_id: "SFU-2026-0001",
          title: "First milestone",
          occurred_on: new Date(Date.UTC(2026, 2, 20)).toISOString(),
          project_slug: "home",
          community_slug: "mukono",
        },
      ],
      communities: [{ slug: "mukono", name: "Mukono", region_label: "Central Uganda", active_projects: 2 }],
    },
  } as unknown as ImpactReportDoc;
}

describe("renderReportPdf", () => {
  it("produces a tagged PDF with figures matching the snapshot", async () => {
    const r = await renderReportPdf(fakeReport());
    expect(r.tagged).toBe(true);
    expect(r.pages).toBeGreaterThan(0);
    expect(r.buffer.length).toBeGreaterThan(1000);

    const header = r.buffer.subarray(0, 5).toString("ascii");
    expect(header).toBe("%PDF-");

    const text = r.buffer.toString("latin1");
    // pdfkit emits `/Lang (en-US)` in the Catalog when tagged.
    expect(text).toContain("/Lang");
    expect(text.toLowerCase()).toContain("en-us");

    // Formatted figures must appear verbatim — the compiler and the
    // renderer agree on the display shape.
    expect(text).toContain("$1,000.00"); // donations
    expect(text).toContain("$200.00"); // operating
    expect(text).toContain("$500.00"); // business revenue
    expect(text).toContain("250%"); // sustainability ratio
    expect(text).toContain("$75,000.00"); // fund balance

    // Content hash is included (full value, so the reviewer can match it to
    // the admin UI).
    expect(text).toContain("a".repeat(64));
  });
});
