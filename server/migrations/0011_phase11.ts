import mongoose from "mongoose";
import { log } from "@/util/log.js";

// =============================================================================
// Phase 11 — Children's future fund.
//
// MAIN database only. The PRIVATE database's collections and indexes are
// provisioned by `migrations/private/0001_private.ts`, which runs with
// MONGO_URI_PRIVATE under the `sfu_beneficiary` user and is NOT part of
// this file. That separation is deliberate — this migration never
// authenticates against the private DB.
// =============================================================================

export const name = "0011_phase11";

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
  await ensureCollection("beneficiary_fund_summaries", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: [
          "organization_id",
          "public_fund_id",
          "total_in_cents",
          "total_out_cents",
          "balance_cents",
          "beneficiary_count",
          "base_currency",
        ],
        properties: {
          beneficiary_count: { bsonType: "int", minimum: 0 },
          base_currency: { bsonType: "string", maxLength: 3 },
        },
      },
    },
    validationLevel: "moderate",
    validationAction: "error",
  });

  const db = mongoose.connection.db!;
  await db
    .collection("beneficiary_fund_summaries")
    .createIndex({ organization_id: 1, public_fund_id: 1 }, { unique: true });
}
