import mongoose from "mongoose";
import { log } from "@/util/log.js";

// =============================================================================
// Phase 8 — businesses, business production, and ledger business dimension.
//
// Changes:
//   • new collection: businesses (validator + indexes)
//   • new collection: business_production (validator + indexes)
//   • existing: ledger_entries indexed on (organization_id, business_id, posted_at)
//   • existing: expense_categories grow is_operating / is_programme flags
//     (defaulted to false; operators flip explicitly from the admin UI)
// Idempotent: safe to re-run.
// =============================================================================

export const name = "0008_phase8";

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
  await ensureCollection("businesses", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "slug", "name", "kind", "status", "public_visibility"],
        properties: {
          slug: { bsonType: "string", maxLength: 120 },
          name: { bsonType: "string", maxLength: 160 },
          kind: {
            enum: ["farming", "livestock", "poultry", "crafts", "retail", "services", "other"],
          },
          status: { enum: ["planned", "active", "paused", "retired"] },
          public_visibility: { enum: ["internal", "public"] },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await ensureCollection("business_production", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: [
          "organization_id",
          "business_id",
          "quantity",
          "unit",
          "source_currency",
          "gross_source_cents",
          "gross_base_cents",
          "occurred_on",
          "state",
          "submitted_by",
        ],
        properties: {
          state: {
            enum: ["draft", "submitted", "approved", "posted", "rejected", "reversed"],
          },
          unit: { enum: ["kg", "g", "l", "ml", "unit", "pack", "dozen", "hour", "other"] },
          source_currency: { bsonType: "string", minLength: 3, maxLength: 3 },
          gross_source_cents: { bsonType: ["int", "long", "double", "number"], minimum: 0 },
          gross_base_cents: { bsonType: ["int", "long", "double", "number"], minimum: 0 },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  const db = mongoose.connection.db!;

  await db.collection("businesses").createIndex({ organization_id: 1, slug: 1 }, { unique: true });
  await db
    .collection("businesses")
    .createIndex({ organization_id: 1, community_id: 1, status: 1 }, { name: "org_community_status" });

  await db
    .collection("business_production")
    .createIndex({ organization_id: 1, business_id: 1, occurred_on: -1 });
  await db
    .collection("business_production")
    .createIndex({ organization_id: 1, state: 1, submitted_at: -1 });
  await db.collection("business_production").createIndex(
    { submitted_by: 1, idempotency_key: 1 },
    { unique: true, partialFilterExpression: { idempotency_key: { $type: "string" } } }
  );

  // Ledger: business_id sparse index for sustainability aggregation.
  await db
    .collection("ledger_entries")
    .createIndex(
      { organization_id: 1, business_id: 1, posted_at: -1 },
      { name: "org_business_posted", sparse: true }
    );

  // Backfill: ensure expense_categories have the two new boolean flags
  // (default false). Running this against an already-flagged collection is a
  // no-op — Mongo won't rewrite rows that already have the key.
  await db
    .collection("expense_categories")
    .updateMany(
      { is_operating: { $exists: false } },
      { $set: { is_operating: false } }
    );
  await db
    .collection("expense_categories")
    .updateMany(
      { is_programme: { $exists: false } },
      { $set: { is_programme: false } }
    );
}
