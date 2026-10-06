import mongoose, { Schema } from "mongoose";

// =============================================================================
// Report export (Phase 9). One row per PDF generated for a report. The file
// is stored in object storage (R2 "reports" bucket); this row carries the
// pointer, the compiler + report content hash it was generated from, and
// the usual pipeline-state fields.
//
// Immutable once "ready" — a change to the report compiles a NEW export.
// =============================================================================

export type ReportExportState = "queued" | "rendering" | "ready" | "failed";

export type ReportExportDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  report_id: mongoose.Types.ObjectId;
  period_code: string;
  state: ReportExportState;
  // Snapshot hash this PDF was rendered from — guarantees a visitor who
  // downloads the file sees exactly the figures approved.
  snapshot_content_hash: string;
  bucket: string;
  key: string;
  bytes: number;
  pages: number;
  sha256: string | null; // body hash of the generated PDF
  // Accessibility declaration: the renderer always emits a tagged PDF
  // (PDF/UA basics — document title, lang, outlines, text alternatives).
  tagged: boolean;
  // Error diagnostics for a failed render — never contains PII.
  error_message: string | null;
  requested_by: mongoose.Types.ObjectId;
  requested_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

const ReportExportSchema = new Schema<ReportExportDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    report_id: { type: Schema.Types.ObjectId, required: true, ref: "ImpactReport" },
    period_code: { type: String, required: true, maxlength: 20 },
    state: {
      type: String,
      enum: ["queued", "rendering", "ready", "failed"],
      required: true,
      default: "queued",
    },
    snapshot_content_hash: { type: String, required: true, maxlength: 64 },
    bucket: { type: String, default: "", maxlength: 160 },
    key: { type: String, default: "", maxlength: 300 },
    bytes: { type: Number, default: 0 },
    pages: { type: Number, default: 0 },
    sha256: { type: String, default: null, maxlength: 64 },
    tagged: { type: Boolean, default: false },
    error_message: { type: String, default: null, maxlength: 1000 },
    requested_by: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    requested_at: { type: Date, required: true, default: () => new Date() },
    started_at: { type: Date, default: null },
    completed_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, collection: "report_exports" }
);

ReportExportSchema.index({ organization_id: 1, report_id: 1, requested_at: -1 });
ReportExportSchema.index({ state: 1, requested_at: 1 });

export const ReportExport =
  (mongoose.models.ReportExport as mongoose.Model<ReportExportDoc> | undefined) ?? mongoose.model<ReportExportDoc>("ReportExport", ReportExportSchema);
