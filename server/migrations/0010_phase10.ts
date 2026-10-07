import mongoose from "mongoose";
import { log } from "@/util/log.js";

// =============================================================================
// Phase 10 — AI assistant and multilingual video summaries.
//
// Collections:
//   • ai_generations        — every AI call is logged here with input snapshot,
//                             output, validation result, acceptance, tokens
//                             and latency. Readable by founders only (§17.4).
//   • video_captions        — per-video source transcript, provider id and
//                             language. One per language per video.
//   • video_translations    — on-demand machine translation of a reviewed
//                             English summary, cached per (video, language).
//
// Idempotent: safe to re-run.
// =============================================================================

export const name = "0010_phase10";

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
  await ensureCollection("ai_generations", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: [
          "organization_id",
          "purpose",
          "actor_id",
          "entity_type",
          "model",
          "input_snapshot",
          "output",
          "validation_result",
          "tokens",
          "latency_ms",
          "created_at",
        ],
        properties: {
          purpose: {
            enum: [
              "accomplishment.draft",
              "video.summary",
              "video.translate",
              "video.transcribe",
            ],
          },
          entity_type: { enum: ["accomplishment", "video", "media_asset"] },
          model: { bsonType: "string", maxLength: 120 },
          accepted: { bsonType: ["bool", "null"] },
          validation_result: { bsonType: "object" },
          tokens: { bsonType: "object" },
          latency_ms: { bsonType: "int", minimum: 0 },
        },
      },
    },
    validationLevel: "moderate",
    validationAction: "error",
  });

  await ensureCollection("video_captions", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "media_asset_id", "language", "state"],
        properties: {
          language: { bsonType: "string", maxLength: 10 },
          state: { enum: ["pending", "ready", "failed"] },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await ensureCollection("video_translations", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: [
          "organization_id",
          "media_asset_id",
          "language",
          "source_hash",
          "state",
        ],
        properties: {
          language: { bsonType: "string", maxLength: 10 },
          source_hash: { bsonType: "string", maxLength: 64 },
          state: { enum: ["pending", "ready", "failed"] },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  const db = mongoose.connection.db!;

  await db
    .collection("ai_generations")
    .createIndex({ organization_id: 1, created_at: -1 });
  await db
    .collection("ai_generations")
    .createIndex({ organization_id: 1, entity_type: 1, entity_id: 1, created_at: -1 });
  await db
    .collection("ai_generations")
    .createIndex({ organization_id: 1, actor_id: 1, created_at: -1 });
  // TTL — keep AI logs 400 days, same horizon as audit.
  await db
    .collection("ai_generations")
    .createIndex({ created_at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 400 });

  await db
    .collection("video_captions")
    .createIndex(
      { organization_id: 1, media_asset_id: 1, language: 1 },
      { unique: true, name: "video_captions_lang_unique" }
    );

  await db
    .collection("video_translations")
    .createIndex(
      { organization_id: 1, media_asset_id: 1, language: 1 },
      { unique: true, name: "video_translations_lang_unique" }
    );
  await db
    .collection("video_translations")
    .createIndex({ state: 1, created_at: 1 });
}
