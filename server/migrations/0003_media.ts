import mongoose from "mongoose";
import { log } from "@/util/log.js";

export const name = "0003_media";

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
  await ensureCollection("media_assets", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "kind", "status", "visibility", "bucket", "key", "mime_declared", "bytes", "original_filename"],
        properties: {
          kind: { enum: ["photo", "document", "video"] },
          status: {
            enum: [
              "ticketed",
              "uploading",
              "pending_scan",
              "pending_processing",
              "ready",
              "rejected",
              "deleted",
            ],
          },
          visibility: { enum: ["internal", "public"] },
          bytes: { bsonType: ["int", "long", "double"], minimum: 0 },
          mime_declared: { bsonType: "string", maxLength: 128 },
          original_filename: { bsonType: "string", maxLength: 255 },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await ensureCollection("media_links", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "asset_id", "target", "target_id"],
        properties: {
          target: {
            enum: ["community", "project", "accomplishment", "user", "story", "page", "consent_record"],
          },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await ensureCollection("consent_records", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "subject_identifier", "subject_display", "scope", "granted_by", "granted_at"],
        properties: {
          subject_identifier: { bsonType: "string", maxLength: 128 },
          subject_display: { bsonType: "string", maxLength: 200 },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  const db = mongoose.connection.db!;
  await db.collection("media_assets").createIndexes([
    { key: { organization_id: 1, kind: 1, status: 1, created_at: -1 }, name: "org_kind_status_created" },
    { key: { organization_id: 1, visibility: 1, status: 1, created_at: -1 }, name: "org_visibility_status_created" },
    { key: { "provider.asset_id": 1 }, name: "provider_asset_id", sparse: true },
    { key: { bucket: 1, key: 1 }, name: "bucket_key_unique", unique: true },
  ]);
  await db.collection("media_links").createIndexes([
    { key: { organization_id: 1, target: 1, target_id: 1, order: 1 }, name: "org_target_order" },
    { key: { asset_id: 1 }, name: "asset_id" },
    {
      key: { asset_id: 1, target: 1, target_id: 1, role: 1 },
      name: "asset_target_role_unique",
      unique: true,
      partialFilterExpression: { role: { $type: "string" } },
    },
  ]);
  await db.collection("consent_records").createIndexes([
    { key: { organization_id: 1, subject_identifier: 1, revoked_at: 1 }, name: "org_subject_revoked" },
    { key: { organization_id: 1, granted_at: -1 }, name: "org_granted_at" },
  ]);
}
