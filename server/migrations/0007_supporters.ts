import mongoose from "mongoose";
import { log } from "@/util/log.js";

export const name = "0007_supporters";

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
  await ensureCollection("supporter_profiles", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "user_id", "display_name", "unsubscribe_token_hash"],
        properties: {
          display_name: { bsonType: "string", maxLength: 120 },
          unsubscribe_token_hash: { bsonType: "string", maxLength: 64 },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });
  await ensureCollection("project_follows", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "user_id", "project_id"],
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });
  await ensureCollection("notifications", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "user_id", "topic", "title", "dedup_key"],
        properties: {
          topic: {
            enum: [
              "accomplishment_published",
              "milestone_completed",
              "project_update",
              "donation_receipt",
              "system",
            ],
          },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });
  await ensureCollection("email_deliveries", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "to_email", "template", "idempotency_key", "subject", "status"],
        properties: {
          status: { enum: ["queued", "sending", "sent", "bounced", "complained", "failed"] },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  const db = mongoose.connection.db!;
  await db.collection("supporter_profiles").createIndexes([
    { key: { organization_id: 1, user_id: 1 }, name: "org_user_unique", unique: true },
    { key: { unsubscribe_token_hash: 1 }, name: "unsub_unique", unique: true },
  ]);
  await db.collection("project_follows").createIndexes([
    { key: { organization_id: 1, user_id: 1, project_id: 1 }, name: "org_user_project_unique", unique: true },
    { key: { project_id: 1 }, name: "project" },
    { key: { organization_id: 1, user_id: 1 }, name: "org_user" },
  ]);
  await db.collection("notifications").createIndexes([
    { key: { user_id: 1, dedup_key: 1 }, name: "user_dedup_unique", unique: true },
    { key: { user_id: 1, read_at: 1, created_at: -1 }, name: "user_read_created" },
    { key: { organization_id: 1, topic: 1, created_at: -1 }, name: "org_topic_created" },
  ]);
  await db.collection("email_deliveries").createIndexes([
    { key: { organization_id: 1, idempotency_key: 1 }, name: "org_idem_unique", unique: true },
    { key: { organization_id: 1, status: 1, created_at: -1 }, name: "org_status_created" },
    { key: { to_email: 1, template: 1, created_at: -1 }, name: "email_tpl_created" },
  ]);

  // Users: add fields; validator stays identical because 0001 did not set
  // additionalProperties, so the new fields are permitted implicitly.
  await db.collection("users").createIndexes([
    { key: { email_verified_at: 1 }, name: "verified_at", sparse: true },
    { key: { verification_token_hash: 1 }, name: "verif_token", sparse: true },
  ]);
}
