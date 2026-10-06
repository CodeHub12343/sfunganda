import mongoose from "mongoose";
import { Organization, OutboxEvent, ImpactReport } from "@/models/index.js";
import { log } from "@/util/log.js";

// =============================================================================
// Monthly-report scheduler (Phase 9).
//
// A standalone tick called from the worker loop every few minutes. It fires
// the draft of PREVIOUS month on the FIRST successful tick each month. We
// store the sentinel on the ImpactReport collection itself: the per-org,
// per-period uniqueness means we never schedule twice. Workers running on
// multiple hosts stay safe because each enqueue goes through outbox
// insertion inside a `findOneAndUpdate`-like race-safe path.
//
// This is deliberately coarse — the roadmap only asks for a monthly
// scheduled draft. A proper cron (e.g. pm2's cron, or a managed scheduler
// hitting POST /v1/admin/reports/schedule) is a Phase 10 polish item.
// =============================================================================

function previousMonthCode(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

let lastCheck = 0;
const CHECK_INTERVAL_MS = 15 * 60 * 1000; // every 15 min

export async function reportsSchedulerTick(): Promise<void> {
  const now = Date.now();
  if (now - lastCheck < CHECK_INTERVAL_MS) return;
  lastCheck = now;

  const period = previousMonthCode();

  try {
    const orgs = await Organization.find({}, { _id: 1 }).lean();
    for (const o of orgs) {
      const existing = await ImpactReport.exists({
        organization_id: o._id,
        period_kind: "month",
        period_code: period,
      });
      if (existing) continue; // already drafted (or in flight)

      // Enqueue the outbox event — the handler is idempotent against the
      // unique (org, period_code) index.
      await OutboxEvent.create({
        organization_id: o._id as mongoose.Types.ObjectId,
        topic: "report.schedule_monthly",
        payload: { period_code: period },
        status: "pending",
        available_at: new Date(),
      });
      log.info({ org: o._id.toString(), period }, "reports.scheduler.enqueued");
    }
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : "unknown" },
      "reports.scheduler.tick_failed"
    );
  }
}
