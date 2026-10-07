import { Router } from "express";
import mongoose from "mongoose";
import { isConnected } from "@/config/db.js";

// Health endpoints — three tiers, all unauthenticated:
//   /health/live   — process is up (never fails except on crash)
//   /health/ready  — ready to serve traffic (DB connected, migrations applied)
//   /health/status — operational detail for monitoring: outbox lag, integrity
//                    report tip, oldest in_review accomplishment, etc.
// The status payload is intentionally minimal — it carries no secrets and
// is safe to scrape anonymously.

const router = Router();

router.get("/live", (_req, res) => {
  res.setHeader("cache-control", "no-store");
  res.json({ status: "ok", service: "sfu-api", at: new Date().toISOString() });
});

router.get("/ready", async (_req, res) => {
  res.setHeader("cache-control", "no-store");
  const dbOk = isConnected();
  let migrationsOk = false;
  let migrationTip: string | null = null;
  try {
    const db = mongoose.connection.db;
    if (db) {
      const rows = await db
        .collection("schema_migrations")
        .find({})
        .project({ name: 1 })
        .sort({ _id: -1 })
        .limit(1)
        .toArray();
      migrationsOk = rows.length > 0;
      migrationTip = (rows[0]?.name as string | undefined) ?? null;
    }
  } catch {
    migrationsOk = false;
  }
  const ok = dbOk && migrationsOk;
  res.status(ok ? 200 : 503).json({
    status: ok ? "ok" : "degraded",
    db: dbOk ? "connected" : "disconnected",
    migrations: migrationsOk ? "applied" : "missing",
    migration_tip: migrationTip,
    at: new Date().toISOString(),
  });
});

router.get("/status", async (_req, res) => {
  res.setHeader("cache-control", "no-store");
  const db = mongoose.connection.db;
  const out = {
    status: "ok" as "ok" | "degraded" | "critical",
    service: "sfu-api",
    at: new Date().toISOString(),
    db: isConnected() ? "connected" : "disconnected",
    outbox: { pending: 0, failed: 0, oldest_pending_s: 0 },
    accomplishments: { oldest_in_review_s: 0 },
    integrity: { last_report_at: null as string | null, ok: null as boolean | null },
  };
  if (!db) {
    out.status = "degraded";
    res.status(503).json(out);
    return;
  }
  try {
    const now = Date.now();
    const [pending, failed, oldestPending] = await Promise.all([
      db.collection("outbox_events").countDocuments({ status: "pending" }),
      db.collection("outbox_events").countDocuments({ status: "failed" }),
      db
        .collection("outbox_events")
        .find({ status: "pending" })
        .project({ created_at: 1 })
        .sort({ created_at: 1 })
        .limit(1)
        .toArray(),
    ]);
    out.outbox.pending = pending;
    out.outbox.failed = failed;
    const row = oldestPending[0];
    if (row?.created_at instanceof Date) {
      out.outbox.oldest_pending_s = Math.round((now - row.created_at.getTime()) / 1000);
    }

    const oldestReview = await db
      .collection("accomplishments")
      .find({ state: "in_review" })
      .project({ updated_at: 1 })
      .sort({ updated_at: 1 })
      .limit(1)
      .toArray();
    const r = oldestReview[0];
    if (r?.updated_at instanceof Date) {
      out.accomplishments.oldest_in_review_s = Math.round((now - r.updated_at.getTime()) / 1000);
    }

    const integrity = await db
      .collection("integrity_reports")
      .find({})
      .project({ ran_at: 1, ok: 1 })
      .sort({ ran_at: -1 })
      .limit(1)
      .toArray();
    const i = integrity[0];
    if (i) {
      out.integrity.last_report_at =
        i.ran_at instanceof Date ? i.ran_at.toISOString() : null;
      out.integrity.ok = Boolean(i.ok);
    }

    if (failed > 0) out.status = "degraded";
    if (out.outbox.oldest_pending_s > 15 * 60) out.status = "degraded";
    if (out.integrity.ok === false) out.status = "critical";
  } catch {
    out.status = "degraded";
  }
  res.status(out.status === "critical" ? 503 : 200).json(out);
});

export default router;
