import mongoose from "mongoose";
import { log } from "@/util/log.js";

export const name = "0004_projects";

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
  await ensureCollection("project_categories", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "name", "slug"],
        properties: {
          name: { bsonType: "string", maxLength: 120 },
          slug: { bsonType: "string", maxLength: 120 },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await ensureCollection("projects", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "community_id", "name", "slug", "summary", "status"],
        properties: {
          status: { enum: ["planning", "active", "paused", "completed", "archived"] },
          progress_pct: { bsonType: ["int", "double"], minimum: 0, maximum: 100 },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await ensureCollection("project_milestones", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "project_id", "title", "status"],
        properties: {
          status: { enum: ["planned", "in_progress", "complete", "cancelled"] },
          weight: { bsonType: ["int", "double"], minimum: 1, maximum: 100 },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await ensureCollection("accomplishments", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "project_id", "state", "title", "summary", "body_markdown", "occurred_on", "created_by"],
        properties: {
          state: {
            enum: [
              "draft",
              "submitted",
              "in_review",
              "changes_requested",
              "approved",
              "published",
              "rejected",
              "archived",
            ],
          },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await ensureCollection("accomplishment_revisions", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "accomplishment_id", "version", "state_before", "state_after", "snapshot", "by_user_id"],
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await ensureCollection("approval_events", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "accomplishment_id", "kind", "by_user_id", "from_state", "to_state", "version_at"],
        properties: {
          kind: {
            enum: ["submit", "claim_review", "approve", "request_changes", "reject", "publish", "withdraw", "archive"],
          },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await ensureCollection("metric_definitions", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "key", "label", "unit", "aggregate"],
        properties: {
          aggregate: { enum: ["sum", "avg", "max", "last"] },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await ensureCollection("metric_entries", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "definition_id", "value", "occurred_on", "recorded_by"],
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  const db = mongoose.connection.db!;
  await db.collection("project_categories").createIndexes([
    { key: { organization_id: 1, slug: 1 }, name: "org_slug_unique", unique: true },
  ]);
  await db.collection("projects").createIndexes([
    { key: { organization_id: 1, slug: 1 }, name: "org_slug_unique", unique: true },
    { key: { organization_id: 1, status: 1, updated_at: -1 }, name: "org_status_updated" },
    { key: { organization_id: 1, community_id: 1 }, name: "org_community" },
  ]);
  await db.collection("project_milestones").createIndexes([
    { key: { organization_id: 1, project_id: 1, order: 1 }, name: "org_project_order" },
    { key: { organization_id: 1, status: 1 }, name: "org_status" },
  ]);
  await db.collection("accomplishments").createIndexes([
    {
      key: { organization_id: 1, public_id: 1 },
      name: "org_public_id_unique",
      unique: true,
      partialFilterExpression: { public_id: { $type: "string" } },
    },
    { key: { organization_id: 1, state: 1, updated_at: -1 }, name: "org_state_updated" },
    { key: { organization_id: 1, project_id: 1, state: 1 }, name: "org_project_state" },
    { key: { organization_id: 1, published_at: -1 }, name: "org_published_at", sparse: true },
  ]);
  await db.collection("accomplishment_revisions").createIndexes([
    { key: { accomplishment_id: 1, version: -1 }, name: "acc_version" },
    { key: { organization_id: 1, created_at: -1 }, name: "org_created" },
  ]);
  await db.collection("approval_events").createIndexes([
    { key: { accomplishment_id: 1, created_at: -1 }, name: "acc_created" },
    { key: { organization_id: 1, created_at: -1 }, name: "org_created" },
    { key: { organization_id: 1, kind: 1, created_at: -1 }, name: "org_kind_created" },
  ]);
  await db.collection("metric_definitions").createIndexes([
    { key: { organization_id: 1, key: 1 }, name: "org_key_unique", unique: true },
  ]);
  await db.collection("metric_entries").createIndexes([
    { key: { organization_id: 1, definition_id: 1, occurred_on: -1 }, name: "org_def_occurred" },
    { key: { organization_id: 1, project_id: 1, occurred_on: -1 }, name: "org_project_occurred" },
    { key: { accomplishment_id: 1 }, name: "accomplishment" },
  ]);
}
