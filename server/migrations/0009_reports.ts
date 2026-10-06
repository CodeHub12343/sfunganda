import mongoose from "mongoose";
import { log } from "@/util/log.js";

// =============================================================================
// Phase 9 — impact_reports + report_exports.
// Idempotent: safe to re-run.
// =============================================================================

export const name = "0009_reports";

async function ensureCollection(name: string, options: Record<string, unknown>): Promise<void> {
  const db = mongoose.connection.db!;
  const existing = (await db.listCollections({ name }).toArray()).map((c) => c.name);
  if (!existing.includes(name)) {
    await db.createCollection(name, options);
    log.info({ collection: name }, "migration.collection_created");
  } else {
    await db.command({ collMod: name, ...options });
    log.info({ collection: name }, "migration.collection_updated");
  }
}

export async function up(): Promise<void> {
  await ensureCollection("impact_reports", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: [
          "organization_id",
          "period_kind",
          "period_code",
          "title",
          "state",
          "created_by",
        ],
        properties: {
          period_kind: { enum: ["month", "quarter", "year"] },
          period_code: { bsonType: "string", maxLength: 20 },
          title: { bsonType: "string", maxLength: 200 },
          state: {
            enum: [
              "draft",
              "compiled",
              "finance_signed",
              "approved",
              "published",
              "archived",
              "changes_requested",
            ],
          },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await ensureCollection("report_exports", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: [
          "organization_id",
          "report_id",
          "period_code",
          "state",
          "snapshot_content_hash",
          "requested_by",
          "requested_at",
        ],
        properties: {
          state: { enum: ["queued", "rendering", "ready", "failed"] },
          snapshot_content_hash: { bsonType: "string", maxLength: 64 },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  const db = mongoose.connection.db!;

  await db
    .collection("impact_reports")
    .createIndex(
      { organization_id: 1, period_kind: 1, period_code: 1 },
      { unique: true, name: "org_period_unique" }
    );
  await db
    .collection("impact_reports")
    .createIndex({ organization_id: 1, state: 1, period_code: -1 });

  await db
    .collection("report_exports")
    .createIndex({ organization_id: 1, report_id: 1, requested_at: -1 });
  await db.collection("report_exports").createIndex({ state: 1, requested_at: 1 });
}
