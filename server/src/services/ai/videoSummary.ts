import { createHash } from "node:crypto";
import mongoose from "mongoose";
import {
  AiGeneration,
  MediaAsset,
  VideoCaption,
  VideoTranslation,
} from "@/models/index.js";
import type { Actor } from "@/policy/index.js";
import { can } from "@/policy/index.js";
import { AppError } from "@/util/errors.js";
import { env } from "@/config/env.js";
import { getProvider } from "./provider.js";
import { requireCapAvailable } from "./caps.js";

// =============================================================================
// R-D — Multilingual video summaries.
//
// Flow:
//   1. Transcript is written by `upsertTranscript` (worker fetches from the
//      provider; a reviewer may paste one in via the admin screen).
//   2. A staff member edits a short English summary (`reviewed_summary`)
//      on the caption row.
//   3. Visitors call `getTranslation(video, language)`:
//        • "en" — serve the reviewed_summary directly, no AI.
//        • other — look up the (video, language) cache; translate on miss
//          and cache; always return machine-translated label.
// =============================================================================

export function sourceHash(parts: { text: string; summary: string }): string {
  return createHash("sha256").update(`${parts.text}\n---\n${parts.summary}`).digest("hex");
}

export async function upsertTranscript(args: {
  organization_id: string;
  media_asset_id: string;
  language?: string;
  text: string;
  cues?: Array<{ start_ms: number; end_ms: number; text: string }>;
  provider?: string;
  provider_asset_id?: string | null;
}): Promise<void> {
  const language = args.language ?? "en";
  await VideoCaption.updateOne(
    {
      organization_id: new mongoose.Types.ObjectId(args.organization_id),
      media_asset_id: new mongoose.Types.ObjectId(args.media_asset_id),
      language,
    },
    {
      $set: {
        state: "ready",
        provider: args.provider ?? "stream",
        provider_asset_id: args.provider_asset_id ?? null,
        text: args.text.slice(0, 100_000),
        cues: (args.cues ?? []).slice(0, 2000),
        error: null,
      },
      $setOnInsert: {
        organization_id: new mongoose.Types.ObjectId(args.organization_id),
        media_asset_id: new mongoose.Types.ObjectId(args.media_asset_id),
        language,
        reviewed_summary: "",
        reviewed_summary_by: null,
        reviewed_summary_at: null,
        source_hash: null,
      },
    },
    { upsert: true }
  );
}

export async function setReviewedSummary(
  actor: Actor,
  args: { media_asset_id: string; summary: string }
): Promise<void> {
  if (!can(actor, "media.publish")) throw new AppError("forbidden", "cannot edit video summary");
  const orgId = new mongoose.Types.ObjectId(actor.organization_id);
  const assetId = new mongoose.Types.ObjectId(args.media_asset_id);
  const asset = await MediaAsset.findOne({ _id: assetId, organization_id: orgId }).lean();
  if (!asset) throw new AppError("not_found", "video not found");

  const caption = await VideoCaption.findOne({ organization_id: orgId, media_asset_id: assetId, language: "en" });
  if (!caption) throw new AppError("not_found", "no transcript to summarise");
  caption.reviewed_summary = args.summary.slice(0, 2000);
  caption.reviewed_summary_by = new mongoose.Types.ObjectId(actor.user_id);
  caption.reviewed_summary_at = new Date();
  caption.source_hash = sourceHash({ text: caption.text, summary: caption.reviewed_summary });
  await caption.save();
}

// Called by the "Draft English summary" button in the admin screen —
// optional helper that pre-fills the editable summary from the transcript.
export async function draftEnglishSummary(
  actor: Actor,
  args: { media_asset_id: string }
): Promise<{ summary: string; validation_ok: boolean; generation_id: string }> {
  if (!can(actor, "media.publish")) throw new AppError("forbidden", "cannot draft video summary");
  const provider = getProvider();
  if (!provider.enabled) throw new AppError("not_found", "ai drafting is not available");
  const orgId = new mongoose.Types.ObjectId(actor.organization_id);
  const userId = new mongoose.Types.ObjectId(actor.user_id);
  await requireCapAvailable(orgId, userId);

  const assetId = new mongoose.Types.ObjectId(args.media_asset_id);
  const caption = await VideoCaption.findOne({ organization_id: orgId, media_asset_id: assetId, language: "en" });
  if (!caption || !caption.text) throw new AppError("not_found", "no transcript to summarise");

  const result = await provider.generate({
    system:
      "Produce a 2–3 sentence neutral summary of the transcript. Use only facts from the transcript. Do not add numbers, dates, or names that are not in the transcript. Return only the summary text, no commentary.",
    user: caption.text,
    max_output_tokens: 400,
    timeout_ms: env.AI_DRAFT_TIMEOUT_MS,
  });

  const summary = result.ok
    ? result.fields.body.slice(0, 2000) || result.fields.title.slice(0, 2000)
    : "";
  const [log] = await AiGeneration.create([
    {
      organization_id: orgId,
      purpose: "video.summary",
      actor_id: userId,
      entity_type: "video",
      entity_id: assetId,
      provider: result.provider,
      model: result.model,
      input_snapshot: { transcript: caption.text },
      output: result.ok ? { summary } : null,
      validation_result: { ok: result.ok, findings: [], highlights: [] },
      accepted: null,
      tokens: result.tokens,
      latency_ms: result.latency_ms,
      error_code: result.ok ? null : result.error_code,
      error_message: result.ok ? null : result.error_message,
    },
  ]);
  return { summary, validation_ok: result.ok, generation_id: log._id.toString() };
}

export type PublicTranslation = {
  language: string;
  text: string;
  is_source: boolean;
  machine_translated: boolean;
};

export async function getPublicTranslation(args: {
  organization_id: string;
  media_asset_id: string;
  language: string;
}): Promise<PublicTranslation | null> {
  const orgId = new mongoose.Types.ObjectId(args.organization_id);
  const assetId = new mongoose.Types.ObjectId(args.media_asset_id);
  const en = await VideoCaption.findOne({ organization_id: orgId, media_asset_id: assetId, language: "en" }).lean();
  if (!en || !en.reviewed_summary) return null;
  if (args.language === "en") {
    return { language: "en", text: en.reviewed_summary, is_source: true, machine_translated: false };
  }
  const hash = en.source_hash ?? sourceHash({ text: en.text, summary: en.reviewed_summary });
  const cached = await VideoTranslation.findOne({
    organization_id: orgId,
    media_asset_id: assetId,
    language: args.language,
  }).lean();
  if (cached && cached.state === "ready" && cached.source_hash === hash) {
    return { language: args.language, text: cached.text, is_source: false, machine_translated: true };
  }

  // Miss (or stale) — translate on demand. The provider's own timeout path
  // returns a shaped error so we never throw to the caller.
  const provider = getProvider();
  if (!provider.enabled) {
    // Fall back to English so the page still renders something.
    return { language: "en", text: en.reviewed_summary, is_source: true, machine_translated: false };
  }

  const result = await provider.translate({
    text: en.reviewed_summary,
    target_language: args.language,
    timeout_ms: env.AI_TRANSLATE_TIMEOUT_MS,
  });

  // Log every attempt. For the public endpoint `actor_id` is the organization
  // id (there is no user); this is explicit so founder log-reads can filter
  // user-triggered calls apart from public-triggered ones.
  await AiGeneration.create({
    organization_id: orgId,
    purpose: "video.translate",
    actor_id: orgId,
    entity_type: "video",
    entity_id: assetId,
    provider: result.ok ? result.provider : result.provider,
    model: result.ok ? result.model : result.model,
    input_snapshot: { summary: en.reviewed_summary, target_language: args.language },
    output: result.ok ? { text: result.text } : null,
    validation_result: { ok: result.ok, findings: [], highlights: [] },
    accepted: result.ok ? true : null,
    tokens: result.ok ? result.tokens : { input: 0, output: 0 },
    latency_ms: result.latency_ms,
    error_code: result.ok ? null : result.error_code,
    error_message: result.ok ? null : result.error_message,
  });

  if (!result.ok) {
    await VideoTranslation.updateOne(
      { organization_id: orgId, media_asset_id: assetId, language: args.language },
      {
        $set: { state: "failed", error: result.error_message, source_hash: hash },
        $setOnInsert: { provider: result.provider, model: result.model, text: "" },
      },
      { upsert: true }
    );
    return { language: "en", text: en.reviewed_summary, is_source: true, machine_translated: false };
  }

  await VideoTranslation.updateOne(
    { organization_id: orgId, media_asset_id: assetId, language: args.language },
    {
      $set: {
        state: "ready",
        text: result.text.slice(0, 4000),
        source_hash: hash,
        provider: result.provider,
        model: result.model,
        error: null,
      },
    },
    { upsert: true }
  );
  return {
    language: args.language,
    text: result.text,
    is_source: false,
    machine_translated: true,
  };
}
