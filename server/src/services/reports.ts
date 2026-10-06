import crypto from "node:crypto";
import mongoose from "mongoose";
import { AppError } from "@/util/errors.js";
import {
  ImpactReport,
  ReportExport,
  type ImpactReportState,
} from "@/models/index.js";
import type { Actor } from "@/policy/index.js";
import { can } from "@/policy/index.js";
import { writeAudit } from "./audit.js";
import { enqueue } from "./outbox.js";
import type { RequestCtx } from "./users.js";
import { compileSnapshot } from "./reportCompiler.js";

// =============================================================================
// Reports (Phase 9). State machine, strictly enforced:
//
//   draft
//     ↓ compile              → compiled
//   compiled
//     ↓ edit                 → draft (recompile required)
//     ↓ sign_finance         → finance_signed
//   finance_signed
//     ↓ edit                 → draft (recompile required; sign cleared)
//     ↓ approve              → approved
//   approved
//     ↓ publish              → published
//   published
//     ↓ archive              → archived
//
// At every transition the actor + audit row is captured. Editing the
// editorial surface (summary, body, selected content) after compilation
// drops back to `draft` and clears finance sign-off — the compiler must
// run again on fresh numbers.
// =============================================================================

function toObjectId(id: string, field: string): mongoose.Types.ObjectId {
  if (!mongoose.isValidObjectId(id)) throw new AppError("bad_request", `invalid ${field}`);
  return new mongoose.Types.ObjectId(id);
}

export type ReportInput = {
  period_kind: "month" | "quarter" | "year";
  period_code: string;
  title: string;
};

export async function createReport(
  actor: Actor,
  input: ReportInput,
  ctx: RequestCtx
): Promise<{ id: string }> {
  if (!can(actor, "reports.create")) throw new AppError("forbidden", "forbidden");
  const org_id = toObjectId(actor.organization_id, "organization_id");
  const actor_id = toObjectId(actor.user_id, "actor");

  const session = await mongoose.startSession();
  try {
    let id!: mongoose.Types.ObjectId;
    await session.withTransaction(async () => {
      const dup = await ImpactReport.findOne({
        organization_id: org_id,
        period_kind: input.period_kind,
        period_code: input.period_code,
      }).session(session);
      if (dup) throw new AppError("conflict", "a report for that period already exists");
      const [doc] = await ImpactReport.create(
        [
          {
            organization_id: org_id,
            period_kind: input.period_kind,
            period_code: input.period_code,
            title: input.title,
            state: "draft" as ImpactReportState,
            created_by: actor_id,
          },
        ],
        { session }
      );
      id = doc._id;
      await writeAudit(
        {
          organization_id: org_id,
          actor_id,
          actor_role: null,
          action: "report.create",
          entity_type: "impact_report",
          entity_id: id,
          after: { period_kind: input.period_kind, period_code: input.period_code },
          ip: ctx.ip,
          user_agent: ctx.user_agent,
          request_id: ctx.request_id,
        },
        session
      );
    });
    return { id: id.toString() };
  } finally {
    await session.endSession();
  }
}

export async function editReport(
  actor: Actor,
  id: string,
  patch: {
    title?: string;
    summary?: string;
    body_markdown?: string;
    selected_accomplishment_public_ids?: string[];
    selected_media_ids?: string[];
    version: number;
  },
  ctx: RequestCtx
): Promise<void> {
  if (!can(actor, "reports.edit")) throw new AppError("forbidden", "forbidden");
  const org_id = toObjectId(actor.organization_id, "organization_id");
  const actor_id = toObjectId(actor.user_id, "actor");
  const rid = toObjectId(id, "report_id");

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const r = await ImpactReport.findOne({ _id: rid, organization_id: org_id }).session(session);
      if (!r) throw new AppError("not_found", "report not found");
      if (r.version !== patch.version) throw new AppError("version_conflict", "stale version");
      if (r.state === "published" || r.state === "archived") {
        throw new AppError("conflict", `cannot edit a ${r.state} report`);
      }

      const before = {
        title: r.title,
        summary: r.summary,
        state: r.state,
        finance_signed_by: r.finance_signed_by?.toString() ?? null,
      };

      if (patch.title !== undefined) r.title = patch.title;
      if (patch.summary !== undefined) r.summary = patch.summary;
      if (patch.body_markdown !== undefined) r.body_markdown = patch.body_markdown;
      if (patch.selected_accomplishment_public_ids !== undefined) {
        r.selected_accomplishment_public_ids = patch.selected_accomplishment_public_ids.slice(0, 50);
      }
      if (patch.selected_media_ids !== undefined) {
        r.selected_media_ids = patch.selected_media_ids
          .filter((x) => mongoose.isValidObjectId(x))
          .slice(0, 20)
          .map((x) => new mongoose.Types.ObjectId(x));
      }

      // Any edit after compilation drops back to draft and clears finance
      // sign-off — the numbers must be re-compiled.
      if (r.state === "compiled" || r.state === "finance_signed") {
        r.state = "draft";
        r.finance_signed_by = null;
        r.finance_signed_at = null;
      }
      r.edited_by = actor_id;
      r.version += 1;
      await r.save({ session });

      await writeAudit(
        {
          organization_id: org_id,
          actor_id,
          actor_role: null,
          action: "report.edit",
          entity_type: "impact_report",
          entity_id: r._id,
          before,
          after: { title: r.title, state: r.state },
          ip: ctx.ip,
          user_agent: ctx.user_agent,
          request_id: ctx.request_id,
        },
        session
      );
    });
  } finally {
    await session.endSession();
  }
}

export async function compileReport(
  actor: Actor,
  id: string,
  ctx: RequestCtx
): Promise<{ content_hash: string }> {
  if (!can(actor, "reports.compile")) throw new AppError("forbidden", "forbidden");
  const org_id = toObjectId(actor.organization_id, "organization_id");
  const actor_id = toObjectId(actor.user_id, "actor");
  const rid = toObjectId(id, "report_id");

  const r = await ImpactReport.findOne({ _id: rid, organization_id: org_id });
  if (!r) throw new AppError("not_found", "report not found");
  if (r.state === "published" || r.state === "archived") {
    throw new AppError("conflict", `cannot compile a ${r.state} report`);
  }

  // The compiler itself is read-only; we do its work OUTSIDE the state
  // transaction so a long compile doesn't hold write locks.
  const snapshot = await compileSnapshot({
    organization_id: org_id,
    period_code: r.period_code,
    compiled_by: actor_id.toString(),
  });

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const fresh = await ImpactReport.findOne({ _id: rid, organization_id: org_id }).session(session);
      if (!fresh) throw new AppError("not_found", "report not found");
      // On recompile, finance sign-off is cleared — a new snapshot requires
      // a fresh signature.
      fresh.snapshot = snapshot;
      fresh.state = "compiled";
      fresh.finance_signed_by = null;
      fresh.finance_signed_at = null;
      fresh.version += 1;
      await fresh.save({ session });

      await writeAudit(
        {
          organization_id: org_id,
          actor_id,
          actor_role: null,
          action: "report.compile",
          entity_type: "impact_report",
          entity_id: fresh._id,
          after: {
            content_hash: snapshot.content_hash,
            compiler_version: snapshot.compiler_version,
          },
          ip: ctx.ip,
          user_agent: ctx.user_agent,
          request_id: ctx.request_id,
        },
        session
      );
    });
  } finally {
    await session.endSession();
  }
  return { content_hash: snapshot.content_hash };
}

async function transition(
  actor: Actor,
  id: string,
  action:
    | "reports.sign_finance"
    | "reports.approve"
    | "reports.publish"
    | "reports.archive",
  ctx: RequestCtx
): Promise<void> {
  if (!can(actor, action)) throw new AppError("forbidden", "forbidden");
  const org_id = toObjectId(actor.organization_id, "organization_id");
  const actor_id = toObjectId(actor.user_id, "actor");
  const rid = toObjectId(id, "report_id");

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const r = await ImpactReport.findOne({ _id: rid, organization_id: org_id }).session(session);
      if (!r) throw new AppError("not_found", "report not found");
      const now = new Date();
      const auditBefore = { state: r.state };

      switch (action) {
        case "reports.sign_finance": {
          if (r.state !== "compiled") {
            throw new AppError("conflict", "report must be compiled before finance sign-off");
          }
          if (r.created_by.equals(actor_id)) {
            throw new AppError("forbidden", "the author cannot sign finance");
          }
          r.state = "finance_signed";
          r.finance_signed_by = actor_id;
          r.finance_signed_at = now;
          break;
        }
        case "reports.approve": {
          if (r.state !== "finance_signed") {
            throw new AppError("conflict", "report must be finance-signed before approval");
          }
          if (
            (r.finance_signed_by && r.finance_signed_by.equals(actor_id)) ||
            r.created_by.equals(actor_id)
          ) {
            throw new AppError("forbidden", "approver must differ from author and finance signer");
          }
          r.state = "approved";
          r.approved_by = actor_id;
          r.approved_at = now;
          break;
        }
        case "reports.publish": {
          if (r.state !== "approved") {
            throw new AppError("conflict", "report must be approved before publishing");
          }
          r.state = "published";
          r.published_by = actor_id;
          r.published_at = now;
          break;
        }
        case "reports.archive": {
          if (r.state !== "published") {
            throw new AppError("conflict", "only published reports can be archived");
          }
          r.state = "archived";
          r.archived_by = actor_id;
          r.archived_at = now;
          break;
        }
      }

      r.version += 1;
      await r.save({ session });

      await writeAudit(
        {
          organization_id: org_id,
          actor_id,
          actor_role: null,
          action: action.replace("reports.", "report."),
          entity_type: "impact_report",
          entity_id: r._id,
          before: auditBefore,
          after: { state: r.state },
          ip: ctx.ip,
          user_agent: ctx.user_agent,
          request_id: ctx.request_id,
        },
        session
      );

      // On publish, enqueue a cache-revalidate so /reports and the sitemap
      // refresh.
      if (action === "reports.publish") {
        await enqueue(
          {
            organization_id: org_id,
            topic: "cache.revalidate",
            payload: { tags: ["public:reports"] },
          },
          session
        );
      }
    });
  } finally {
    await session.endSession();
  }
}

export const signFinance = (actor: Actor, id: string, ctx: RequestCtx) =>
  transition(actor, id, "reports.sign_finance", ctx);
export const approveReport = (actor: Actor, id: string, ctx: RequestCtx) =>
  transition(actor, id, "reports.approve", ctx);
export const publishReport = (actor: Actor, id: string, ctx: RequestCtx) =>
  transition(actor, id, "reports.publish", ctx);
export const archiveReport = (actor: Actor, id: string, ctx: RequestCtx) =>
  transition(actor, id, "reports.archive", ctx);

export async function requestExport(
  actor: Actor,
  id: string,
  ctx: RequestCtx
): Promise<{ export_id: string }> {
  if (!can(actor, "reports.export")) throw new AppError("forbidden", "forbidden");
  const org_id = toObjectId(actor.organization_id, "organization_id");
  const actor_id = toObjectId(actor.user_id, "actor");
  const rid = toObjectId(id, "report_id");

  const session = await mongoose.startSession();
  try {
    let export_id!: mongoose.Types.ObjectId;
    await session.withTransaction(async () => {
      const r = await ImpactReport.findOne({ _id: rid, organization_id: org_id }).session(session);
      if (!r) throw new AppError("not_found", "report not found");
      if (!r.snapshot) throw new AppError("conflict", "report has no snapshot — compile first");
      if (r.state === "draft") {
        throw new AppError("conflict", "compile the report before exporting");
      }

      const [doc] = await ReportExport.create(
        [
          {
            organization_id: org_id,
            report_id: r._id,
            period_code: r.period_code,
            state: "queued",
            snapshot_content_hash: r.snapshot.content_hash,
            requested_by: actor_id,
            requested_at: new Date(),
          },
        ],
        { session }
      );
      export_id = doc._id;

      await writeAudit(
        {
          organization_id: org_id,
          actor_id,
          actor_role: null,
          action: "report.export.request",
          entity_type: "report_export",
          entity_id: export_id,
          after: { report_id: r._id.toString(), content_hash: r.snapshot.content_hash },
          ip: ctx.ip,
          user_agent: ctx.user_agent,
          request_id: ctx.request_id,
        },
        session
      );

      await enqueue(
        {
          organization_id: org_id,
          topic: "report.generate_pdf",
          payload: { export_id: export_id.toString() },
        },
        session
      );
    });
    return { export_id: export_id.toString() };
  } finally {
    await session.endSession();
  }
}

export async function listReports(
  actor: Actor,
  opts: { state?: string | null; after?: string | null; limit?: number }
): Promise<{ items: Array<Record<string, unknown>>; next: string | null }> {
  if (!can(actor, "reports.read")) throw new AppError("forbidden", "forbidden");
  const org_id = toObjectId(actor.organization_id, "organization_id");
  const limit = Math.min(100, opts.limit ?? 25);
  const q: Record<string, unknown> = { organization_id: org_id };
  if (opts.state) q.state = opts.state;
  if (opts.after && mongoose.isValidObjectId(opts.after)) {
    q._id = { $lt: new mongoose.Types.ObjectId(opts.after) };
  }
  const rows = await ImpactReport.find(q).sort({ _id: -1 }).limit(limit).lean();
  return {
    items: rows.map((r) => ({
      id: r._id.toString(),
      period_kind: r.period_kind,
      period_code: r.period_code,
      title: r.title,
      state: r.state,
      snapshot_content_hash: r.snapshot?.content_hash ?? null,
      finance_signed_at: r.finance_signed_at,
      approved_at: r.approved_at,
      published_at: r.published_at,
      latest_export_id: r.latest_export_id ? r.latest_export_id.toString() : null,
      version: r.version,
    })),
    next: rows.length === limit && rows.length > 0 ? rows[rows.length - 1]!._id.toString() : null,
  };
}

export async function getReportAdmin(
  actor: Actor,
  id: string
): Promise<Record<string, unknown>> {
  if (!can(actor, "reports.read")) throw new AppError("forbidden", "forbidden");
  const org_id = toObjectId(actor.organization_id, "organization_id");
  const rid = toObjectId(id, "report_id");
  const r = await ImpactReport.findOne({ _id: rid, organization_id: org_id }).lean();
  if (!r) throw new AppError("not_found", "report not found");
  return {
    id: r._id.toString(),
    period_kind: r.period_kind,
    period_code: r.period_code,
    title: r.title,
    state: r.state,
    summary: r.summary,
    body_markdown: r.body_markdown,
    selected_accomplishment_public_ids: r.selected_accomplishment_public_ids,
    selected_media_ids: r.selected_media_ids.map((x) => x.toString()),
    snapshot: r.snapshot,
    created_by: r.created_by.toString(),
    edited_by: r.edited_by ? r.edited_by.toString() : null,
    finance_signed_by: r.finance_signed_by ? r.finance_signed_by.toString() : null,
    finance_signed_at: r.finance_signed_at,
    approved_by: r.approved_by ? r.approved_by.toString() : null,
    approved_at: r.approved_at,
    published_by: r.published_by ? r.published_by.toString() : null,
    published_at: r.published_at,
    latest_export_id: r.latest_export_id ? r.latest_export_id.toString() : null,
    version: r.version,
  };
}

// Used by the worker when it finishes a PDF — stamps the ready export's id
// onto the parent report so the public download points at the current PDF.
export async function markExportReady(
  export_id: mongoose.Types.ObjectId,
  info: { bucket: string; key: string; bytes: number; pages: number; sha256: string }
): Promise<void> {
  const now = new Date();
  const exp = await ReportExport.findById(export_id);
  if (!exp) return;
  exp.state = "ready";
  exp.bucket = info.bucket;
  exp.key = info.key;
  exp.bytes = info.bytes;
  exp.pages = info.pages;
  exp.sha256 = info.sha256;
  exp.tagged = true;
  exp.completed_at = now;
  await exp.save();

  await ImpactReport.updateOne({ _id: exp.report_id }, { $set: { latest_export_id: exp._id } });
}

export async function markExportFailed(
  export_id: mongoose.Types.ObjectId,
  error: string
): Promise<void> {
  await ReportExport.updateOne(
    { _id: export_id },
    {
      $set: {
        state: "failed",
        error_message: error.slice(0, 1000),
        completed_at: new Date(),
      },
    }
  );
}

// Deterministic namespaced id for the scheduled monthly draft, so re-queues
// cannot create duplicates (we rely on the unique period_code index too).
export function monthlyDraftId(period_code: string): string {
  return crypto.createHash("sha256").update(`report.monthly:${period_code}`).digest("hex").slice(0, 32);
}
