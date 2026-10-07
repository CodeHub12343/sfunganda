import mongoose from "mongoose";
import { log } from "@/util/log.js";

// =============================================================================
// Phase 13 — multi-organisation productisation.
//
// No new collections (per the roadmap note "no structural change if §8.6
// was followed"). We add two indexes on `organizations` for the new
// `domains` array and create one collection: `inter_org_transfers`.
// =============================================================================

export const name = "0013_phase13";

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
  const db = mongoose.connection.db!;

  // Phase 13 — index on the domain multikey. Not unique (Mongo can't
  // enforce array-element uniqueness ACROSS documents), but the
  // tenancy service enforces uniqueness inside a transaction.
  await db.collection("organizations").createIndex({ domains: 1 }, { name: "organizations_domains" });

  await ensureCollection("inter_org_transfers", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: [
          "from_organization_id",
          "to_organization_id",
          "from_fund_id",
          "to_fund_id",
          "amount_cents",
          "currency",
          "state",
          "idempotency_key",
          "initiated_by",
          "initiated_at",
        ],
        properties: {
          state: { enum: ["pending", "posted", "failed", "cancelled"] },
          amount_cents: { bsonType: "int", minimum: 1 },
          currency: { bsonType: "string", maxLength: 3 },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await db
    .collection("inter_org_transfers")
    .createIndex({ from_organization_id: 1, idempotency_key: 1 }, { unique: true });
  await db
    .collection("inter_org_transfers")
    .createIndex({ from_organization_id: 1, state: 1, created_at: -1 });
  await db
    .collection("inter_org_transfers")
    .createIndex({ to_organization_id: 1, state: 1, created_at: -1 });
}
