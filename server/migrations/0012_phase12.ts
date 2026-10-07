import mongoose from "mongoose";
import { log } from "@/util/log.js";

// =============================================================================
// Phase 12 — social cross-posting. Two collections in the MAIN DB:
//   • social_connections — one row per (platform, channel), with the
//     active row unique on (org, platform, channel_id).
//   • social_posts        — one row per (accomplishment, media, connection);
//     idempotent via `idempotency_key` unique index.
// =============================================================================

export const name = "0012_phase12";

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
  await ensureCollection("social_connections", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "platform", "channel_id", "channel_name", "status", "connected_by"],
        properties: {
          platform: { enum: ["youtube", "facebook", "instagram", "tiktok"] },
          status: { enum: ["active", "revoked", "error"] },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await ensureCollection("social_posts", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: [
          "organization_id",
          "accomplishment_id",
          "media_asset_id",
          "connection_id",
          "platform",
          "state",
          "idempotency_key",
        ],
        properties: {
          state: { enum: ["queued", "posting", "posted", "failed", "skipped"] },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  const db = mongoose.connection.db!;
  await db.collection("social_connections").createIndex(
    { organization_id: 1, platform: 1, channel_id: 1 },
    { unique: true, partialFilterExpression: { status: "active" }, name: "social_connections_active_unique" }
  );
  await db
    .collection("social_connections")
    .createIndex({ organization_id: 1, status: 1, platform: 1 });

  await db
    .collection("social_posts")
    .createIndex({ organization_id: 1, idempotency_key: 1 }, { unique: true });
  await db
    .collection("social_posts")
    .createIndex({ organization_id: 1, state: 1, created_at: -1 });
  await db
    .collection("social_posts")
    .createIndex({ organization_id: 1, accomplishment_id: 1 });
  await db
    .collection("social_posts")
    .createIndex({ organization_id: 1, connection_id: 1, state: 1 });
}
