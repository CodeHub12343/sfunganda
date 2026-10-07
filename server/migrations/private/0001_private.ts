import mongoose from "mongoose";
import { log } from "@/util/log.js";

// =============================================================================
// Private database (Phase 11). This file runs under the beneficiary user
// against MONGO_URI_PRIVATE. The main migration runner never imports it —
// `migrations/private/run.ts` is the entrypoint, loaded by hand with
//   npm run migrate:private
// which is listed in server/README.md as part of the Phase 11 setup.
//
// Indexes:
//   • beneficiary_private_records: unique (organization_id, ref_code);
//     secondary (organization_id, name_fingerprint) for name search;
//     (organization_id, status) for the admin list.
//   • beneficiary_fund_transactions: unique (organization_id,
//     idempotency_key); (organization_id, state, created_at) and
//     (organization_id, beneficiary_id) for the admin screens.
//   • beneficiary_audit_log: (organization_id, created_at desc) and
//     (organization_id, actor_id, created_at desc) and
//     (organization_id, entity_id).
// =============================================================================

export const name = "0001_private";

async function ensureCollection(
  conn: mongoose.Connection,
  name: string,
  options: Record<string, unknown>
): Promise<void> {
  const db = conn.db!;
  const existing = (await db.listCollections({ name }).toArray()).map((c) => c.name);
  if (!existing.includes(name)) {
    await db.createCollection(name, options);
    log.info({ collection: name }, "private_migration.collection_created");
  } else {
    await db.command({ collMod: name, ...options });
    log.info({ collection: name }, "private_migration.collection_updated");
  }
}

export async function up(conn: mongoose.Connection): Promise<void> {
  await ensureCollection(conn, "beneficiary_private_records", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "ref_code", "name_ct", "name_fingerprint", "status"],
        properties: {
          ref_code: { bsonType: "string", maxLength: 20 },
          status: { enum: ["active", "left", "aged_out"] },
          name_fingerprint: { bsonType: "string", maxLength: 64 },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await ensureCollection(conn, "beneficiary_fund_transactions", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: [
          "organization_id",
          "beneficiary_id",
          "public_fund_id",
          "kind",
          "state",
          "amount_cents",
          "currency",
          "idempotency_key",
          "submitted_by",
          "submitted_at",
        ],
        properties: {
          kind: { enum: ["contribution", "allocation", "distribution", "adjustment"] },
          state: { enum: ["pending", "approved", "rejected", "reversed"] },
          currency: { bsonType: "string", maxLength: 3 },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await ensureCollection(conn, "beneficiary_audit_log", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "actor_id", "action", "entity_type", "entity_id"],
        properties: {
          entity_type: { enum: ["beneficiary", "beneficiary_fund_tx"] },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  const db = conn.db!;
  await db
    .collection("beneficiary_private_records")
    .createIndex({ organization_id: 1, ref_code: 1 }, { unique: true });
  await db
    .collection("beneficiary_private_records")
    .createIndex({ organization_id: 1, name_fingerprint: 1 });
  await db
    .collection("beneficiary_private_records")
    .createIndex({ organization_id: 1, status: 1 });

  await db
    .collection("beneficiary_fund_transactions")
    .createIndex({ organization_id: 1, idempotency_key: 1 }, { unique: true });
  await db
    .collection("beneficiary_fund_transactions")
    .createIndex({ organization_id: 1, state: 1, created_at: -1 });
  await db
    .collection("beneficiary_fund_transactions")
    .createIndex({ organization_id: 1, beneficiary_id: 1, created_at: -1 });

  await db.collection("beneficiary_audit_log").createIndex({ organization_id: 1, created_at: -1 });
  await db
    .collection("beneficiary_audit_log")
    .createIndex({ organization_id: 1, actor_id: 1, created_at: -1 });
  await db
    .collection("beneficiary_audit_log")
    .createIndex({ organization_id: 1, entity_id: 1, created_at: -1 });
}
