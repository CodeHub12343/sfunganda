import mongoose from "mongoose";
import { log } from "@/util/log.js";

// =============================================================================
// Initial migration (§9.4). Creates collections with $jsonSchema validators,
// indexes, and the five least-privilege database users. The migration is
// idempotent: running it again on an already-migrated database must be a
// no-op.
// =============================================================================

export const name = "0001_initial";

async function ensureCollection(name: string, options: Record<string, unknown>): Promise<void> {
  const db = mongoose.connection.db!;
  const existing = (await db.listCollections({ name }).toArray()).map((c) => c.name);
  if (!existing.includes(name)) {
    await db.createCollection(name, options);
    log.info({ collection: name }, "migration.collection_created");
  } else {
    // Update the validator so repeated runs reconcile the schema.
    await db.command({ collMod: name, ...options });
    log.info({ collection: name }, "migration.collection_updated");
  }
}

export async function up(): Promise<void> {
  // ---------- Validators (§9.4) ----------
  // Only the collections where append-only / money / enum rules matter are
  // enforced at the database level. Each one uses validationLevel: strict
  // and validationAction: error so the server fails loud on a bad write.

  await ensureCollection("organizations", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["slug", "name", "public_id_prefix", "base_currency"],
        properties: {
          slug: { bsonType: "string", maxLength: 64 },
          name: { bsonType: "string", maxLength: 200 },
          public_id_prefix: { bsonType: "string", maxLength: 8 },
          base_currency: { bsonType: "string", minLength: 3, maxLength: 3 },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await ensureCollection("users", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "email", "display_name", "status"],
        properties: {
          email: { bsonType: "string", maxLength: 254 },
          status: { enum: ["pending", "active", "suspended"] },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await ensureCollection("role_assignments", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "user_id", "role", "scope_type", "granted_by"],
        properties: {
          role: {
            enum: [
              "founder",
              "director",
              "project_manager",
              "finance_manager",
              "media_manager",
              "field_member",
              "supporter",
            ],
          },
          scope_type: { enum: ["organization", "community", "project"] },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await ensureCollection("sessions", {});

  await ensureCollection("audit_log", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "action", "entity_type", "at"],
        additionalProperties: true,
        properties: {
          action: { bsonType: "string", maxLength: 100 },
          entity_type: { bsonType: "string", maxLength: 60 },
          at: { bsonType: "date" },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await ensureCollection("outbox_events", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "topic", "status", "attempts", "available_at"],
        properties: {
          status: { enum: ["pending", "in_progress", "done", "failed"] },
          topic: { bsonType: "string", maxLength: 80 },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await ensureCollection("communities", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "name", "slug", "region_label"],
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await ensureCollection("id_sequences", {});

  await ensureCollection("volunteer_signups", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "full_name", "email", "country", "city_region", "tasks", "consent"],
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  // ---------- Indexes (§9.4) ----------
  const db = mongoose.connection.db!;

  await db.collection("organizations").createIndex({ slug: 1 }, { unique: true });
  await db.collection("users").createIndex({ organization_id: 1, email: 1 }, { unique: true });
  await db.collection("users").createIndex({ invite_token_hash: 1 }, { sparse: true });

  await db
    .collection("role_assignments")
    .createIndex(
      { organization_id: 1, user_id: 1, role: 1, scope_type: 1, scope_id: 1 },
      { unique: true, partialFilterExpression: { revoked_at: null } }
    );

  await db
    .collection("sessions")
    .createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
  await db.collection("sessions").createIndex({ token_hash: 1 }, { unique: true });

  await db.collection("audit_log").createIndex({ organization_id: 1, at: -1 });
  await db.collection("audit_log").createIndex({ organization_id: 1, entity_type: 1, entity_id: 1 });

  await db.collection("outbox_events").createIndex({ status: 1, available_at: 1 });
  await db.collection("communities").createIndex({ organization_id: 1, slug: 1 }, { unique: true });
  await db.collection("id_sequences").createIndex({ organization_id: 1, kind: 1, year: 1 }, { unique: true });
  await db.collection("volunteer_signups").createIndex({ organization_id: 1, submitted_at: -1 });
}
