import mongoose, { Schema } from "mongoose";

// =============================================================================
// Impact report (Phase 9). A report is a frozen snapshot of the public
// projections for a period, plus editorial content (summary, photo
// selection) and an approval trail.
//
// Workflow states (strict transitions, enforced in the service):
//   draft → compiled → finance_signed → approved → published → archived
//                                   ↘ changes_requested → draft
//
// `snapshot` is the ONLY place numbers live. Once set it is immutable; a
// re-compile returns to `draft` and allocates a new snapshot. Finance
// sign-off locks the financial section; after it, only the editorial
// surface may change — recompiling clears the finance signature.
// =============================================================================

export type ImpactReportState =
  | "draft"
  | "compiled"
  | "finance_signed"
  | "approved"
  | "published"
  | "archived"
  | "changes_requested";

export type ReportPeriodKind = "month" | "quarter" | "year";

export type ReportSnapshot = {
  // Period and canonical time range the snapshot was built from.
  period_kind: ReportPeriodKind;
  period_code: string; // "2026-03" / "2026-Q1" / "2026"
  period_start: string; // ISO
  period_end: string; // ISO, exclusive
  compiled_at: string; // ISO
  compiled_by: string;
  // Compiler fingerprint — a sha256 of the compiler version + input ids +
  // period_code. If the same inputs recompute to a different fingerprint we
  // know the compiler changed.
  compiler_version: string;
  content_hash: string;

  // Public projections (same shape as the public endpoints).
  totals: {
    projects: number;
    communities: number;
    accomplishments: number;
    businesses: number;
  };
  finance: {
    base_currency: string;
    donations_received_base_cents: number;
    operating_expenses_base_cents: number;
    programme_expenses_base_cents: number;
    business_revenue_base_cents: number;
    sustainability_ratio: number; // 0..∞
    fund_balances: Array<{ code: string; name: string; balance_cents: number }>;
  };
  // Published accomplishments in the period, by public_id (no PII).
  accomplishments: Array<{
    public_id: string;
    title: string;
    occurred_on: string;
    project_slug: string;
    community_slug: string;
  }>;
  // Community snapshot (coarse coords only, per Phase 8).
  communities: Array<{
    slug: string;
    name: string;
    region_label: string;
    active_projects: number;
  }>;
};

export type ImpactReportDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  period_kind: ReportPeriodKind;
  period_code: string; // unique per org (reports are one-per-period)
  title: string;
  state: ImpactReportState;
  snapshot: ReportSnapshot | null;
  // Editorial content, authored by media / project managers.
  summary: string; // short lead paragraph
  body_markdown: string; // longer story the report tells
  selected_accomplishment_public_ids: string[];
  selected_media_ids: mongoose.Types.ObjectId[]; // from MediaAsset

  // Approval trail
  created_by: mongoose.Types.ObjectId;
  edited_by: mongoose.Types.ObjectId | null;
  finance_signed_by: mongoose.Types.ObjectId | null;
  finance_signed_at: Date | null;
  approved_by: mongoose.Types.ObjectId | null;
  approved_at: Date | null;
  published_by: mongoose.Types.ObjectId | null;
  published_at: Date | null;
  archived_by: mongoose.Types.ObjectId | null;
  archived_at: Date | null;

  // Latest ready export (so the public download points at the current PDF).
  latest_export_id: mongoose.Types.ObjectId | null;

  created_at: Date;
  updated_at: Date;
  version: number;
};

const SnapshotSchema = new Schema<ReportSnapshot>(
  {
    period_kind: { type: String, enum: ["month", "quarter", "year"], required: true },
    period_code: { type: String, required: true, maxlength: 20 },
    period_start: { type: String, required: true },
    period_end: { type: String, required: true },
    compiled_at: { type: String, required: true },
    compiled_by: { type: String, required: true },
    compiler_version: { type: String, required: true },
    content_hash: { type: String, required: true },
    totals: {
      projects: { type: Number, required: true },
      communities: { type: Number, required: true },
      accomplishments: { type: Number, required: true },
      businesses: { type: Number, required: true },
    },
    finance: {
      base_currency: { type: String, required: true },
      donations_received_base_cents: { type: Number, required: true },
      operating_expenses_base_cents: { type: Number, required: true },
      programme_expenses_base_cents: { type: Number, required: true },
      business_revenue_base_cents: { type: Number, required: true },
      sustainability_ratio: { type: Number, required: true },
      fund_balances: {
        type: [
          new Schema(
            {
              code: { type: String, required: true, maxlength: 40 },
              name: { type: String, required: true, maxlength: 160 },
              balance_cents: { type: Number, required: true },
            },
            { _id: false }
          ),
        ],
        default: [],
      },
    },
    accomplishments: {
      type: [
        new Schema(
          {
            public_id: { type: String, required: true, maxlength: 40 },
            title: { type: String, required: true, maxlength: 200 },
            occurred_on: { type: String, required: true },
            project_slug: { type: String, required: true, maxlength: 120 },
            community_slug: { type: String, required: true, maxlength: 120 },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    communities: {
      type: [
        new Schema(
          {
            slug: { type: String, required: true, maxlength: 120 },
            name: { type: String, required: true, maxlength: 160 },
            region_label: { type: String, required: true, maxlength: 160 },
            active_projects: { type: Number, required: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { _id: false }
);

const ImpactReportSchema = new Schema<ImpactReportDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    period_kind: { type: String, enum: ["month", "quarter", "year"], required: true },
    period_code: { type: String, required: true, maxlength: 20 },
    title: { type: String, required: true, maxlength: 200 },
    state: {
      type: String,
      enum: [
        "draft",
        "compiled",
        "finance_signed",
        "approved",
        "published",
        "archived",
        "changes_requested",
      ],
      required: true,
      default: "draft",
    },
    snapshot: { type: SnapshotSchema, default: null },
    summary: { type: String, default: "", maxlength: 2000 },
    body_markdown: { type: String, default: "", maxlength: 50_000 },
    selected_accomplishment_public_ids: { type: [String], default: [] },
    selected_media_ids: { type: [Schema.Types.ObjectId], ref: "MediaAsset", default: [] },

    created_by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    edited_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    finance_signed_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    finance_signed_at: { type: Date, default: null },
    approved_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approved_at: { type: Date, default: null },
    published_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    published_at: { type: Date, default: null },
    archived_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    archived_at: { type: Date, default: null },

    latest_export_id: { type: Schema.Types.ObjectId, ref: "ReportExport", default: null },
    version: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, collection: "impact_reports" }
);

ImpactReportSchema.index(
  { organization_id: 1, period_kind: 1, period_code: 1 },
  { unique: true }
);
ImpactReportSchema.index({ organization_id: 1, state: 1, period_code: -1 });

export const ImpactReport =
  mongoose.models.ImpactReport ??
  mongoose.model<ImpactReportDoc>("ImpactReport", ImpactReportSchema);
