import mongoose from "mongoose";
import {
  Accomplishment,
  AiGeneration,
  Project,
  ProjectCategory,
  ProjectMilestone,
} from "@/models/index.js";
import type { AiValidationResult, AiGenerationDoc } from "@/models/AiGeneration.js";
import type { Actor } from "@/policy/index.js";
import { can } from "@/policy/index.js";
import { AppError } from "@/util/errors.js";
import { env } from "@/config/env.js";
import { getProvider, type DraftFields } from "./provider.js";
import { maskNames, validateDraft } from "./validators.js";
import { requireCapAvailable } from "./caps.js";

// =============================================================================
// Accomplishment drafting (§17.1–17.3). Called from the review screen's
// "Draft description" button. Produces a candidate set of fields the
// reviewer sees side-by-side with the field report, with validation
// findings highlighting any invented numbers, dates, or names.
//
// The accomplishment is NEVER mutated by this function — it only records
// the generation. The reviewer separately decides to accept (which calls
// `recordAcceptance` and flips `ai_assisted = true`), edit, or discard.
// =============================================================================

const SYSTEM_PROMPT = [
  "You are an assistant that helps staff of a children's charity write up a field report.",
  "RULES, strictly followed:",
  "1. Use only the facts supplied in the user message. Do not add numbers, dates, names, outcomes, costs, or claims that are not stated there.",
  "2. If a piece of information is missing, say so plainly instead of filling the gap.",
  "3. Plain, respectful tone. No descriptions of individual children. No dramatic language.",
  "4. Replace any [PERSON_N] placeholders you see as neutral references (\"a parent\", \"a volunteer\") rather than inventing names.",
  "5. Keep each field short: title ≤ 180 chars; body ≤ 1500 chars; why_it_matters ≤ 400 chars; next_steps ≤ 400 chars.",
  "6. Return a single JSON object with the fields: title, body, why_it_matters, next_steps, facts_used (array of short strings quoting the specific input facts you relied on). No markdown fences, no commentary.",
].join("\n");

export type DraftRequest = {
  accomplishment_id: string;
  // Reviewer may optionally pass the current draft text so the model
  // extends it rather than starting over; otherwise we use the stored body.
  seed_body?: string;
};

export type DraftResponse = {
  generation_id: string;
  provider: string;
  model: string;
  fields: DraftFields | null;
  validation: AiValidationResult;
  // Placeholder → original mapping so the UI can swap names back in on
  // screen. Server never persists real names in the AI log.
  name_map: Record<string, string>;
  error_code: string | null;
  error_message: string | null;
};

function buildInput(opts: {
  project_name: string;
  project_category: string | null;
  milestone_name: string | null;
  occurred_on: string;
  field_report: string;
  seed_body: string;
  pre_entered_numbers: Array<{ label: string; value: number; unit: string | null }>;
}): { user: string; input_snapshot: Record<string, unknown> } {
  const facts = opts.pre_entered_numbers
    .map((p) => `  • ${p.label}: ${p.value}${p.unit ? ` ${p.unit}` : ""}`)
    .join("\n");

  const lines = [
    `Project: ${opts.project_name}`,
    opts.project_category ? `Category: ${opts.project_category}` : null,
    opts.milestone_name ? `Milestone: ${opts.milestone_name}` : null,
    `Date: ${opts.occurred_on}`,
    "",
    "Field report (as written by the staff member — the ONLY source of facts):",
    opts.field_report || "(the author has not written any body text yet)",
    "",
    opts.seed_body ? `Current draft to refine (do not add new facts):\n${opts.seed_body}` : null,
    "",
    facts ? `Pre-entered quantities (also usable):\n${facts}` : null,
  ]
    .filter((l) => l !== null)
    .join("\n");

  return {
    user: lines,
    input_snapshot: {
      project_name: opts.project_name,
      project_category: opts.project_category,
      milestone_name: opts.milestone_name,
      occurred_on: opts.occurred_on,
      field_report: opts.field_report,
      seed_body: opts.seed_body,
      pre_entered_numbers: opts.pre_entered_numbers,
    },
  };
}

export async function draftAccomplishment(
  actor: Actor,
  req: DraftRequest
): Promise<DraftResponse> {
  if (!can(actor, "accomplishments.review") && !can(actor, "accomplishments.author")) {
    throw new AppError("forbidden", "cannot draft for this accomplishment");
  }
  const provider = getProvider();
  if (!provider.enabled) throw new AppError("not_found", "ai drafting is not available");

  const orgId = new mongoose.Types.ObjectId(actor.organization_id);
  const userId = new mongoose.Types.ObjectId(actor.user_id);
  await requireCapAvailable(orgId, userId);

  const doc = await Accomplishment.findOne({
    _id: new mongoose.Types.ObjectId(req.accomplishment_id),
    organization_id: orgId,
  }).lean();
  if (!doc) throw new AppError("not_found", "accomplishment not found");

  // Load context — project and milestone names, category (never beneficiary
  // records, never the author's name).
  const project = await Project.findById(doc.project_id).lean();
  const category = project?.category_id
    ? await ProjectCategory.findById(project.category_id).lean()
    : null;
  const milestone = doc.milestone_id
    ? await ProjectMilestone.findById(doc.milestone_id).lean()
    : null;

  // Pre-filter — mask proper-name spans in the free text.
  const masked = maskNames(doc.body_markdown);
  const preNumbers = doc.metrics.map((m: { definition_id: mongoose.Types.ObjectId; value: number; unit: string | null }) => ({
    label: `metric:${m.definition_id.toString().slice(-6)}`,
    value: m.value,
    unit: m.unit,
  }));
  if (typeof doc.beneficiary_count === "number") {
    preNumbers.push({ label: "beneficiary_count", value: doc.beneficiary_count, unit: null });
  }

  const built = buildInput({
    project_name: project?.name ?? "Unknown project",
    project_category: category?.name ?? null,
    milestone_name: milestone?.name ?? null,
    occurred_on: new Date(doc.occurred_on).toISOString().slice(0, 10),
    field_report: masked.masked,
    seed_body: req.seed_body ? maskNames(req.seed_body).masked : "",
    pre_entered_numbers: preNumbers,
  });

  const result = await provider.generate({
    system: SYSTEM_PROMPT,
    user: built.user,
    max_output_tokens: env.AI_MAX_OUTPUT_TOKENS,
    timeout_ms: env.AI_DRAFT_TIMEOUT_MS,
  });

  // Validate (always, even on provider error — validation stays empty when
  // output is null so the UI can key off `ok`).
  const validation: AiValidationResult = result.ok
    ? validateDraft(result.fields, { input_text: built.user })
    : { ok: false, findings: [], highlights: [] };

  const [row] = await AiGeneration.create([
    {
      organization_id: orgId,
      purpose: "accomplishment.draft",
      actor_id: userId,
      entity_type: "accomplishment",
      entity_id: new mongoose.Types.ObjectId(req.accomplishment_id),
      provider: result.provider,
      model: result.model,
      input_snapshot: built.input_snapshot,
      output: result.ok ? (result.fields as unknown as Record<string, unknown>) : null,
      validation_result: validation,
      accepted: null,
      tokens: result.tokens,
      latency_ms: result.latency_ms,
      error_code: result.ok ? null : result.error_code,
      error_message: result.ok ? null : result.error_message,
    },
  ]);

  return {
    generation_id: row._id.toString(),
    provider: result.provider,
    model: result.model,
    fields: result.ok ? result.fields : null,
    validation,
    name_map: masked.swaps,
    error_code: result.ok ? null : result.error_code,
    error_message: result.ok ? null : result.error_message,
  };
}

// -------- Acceptance / rejection --------------------------------------------

export async function recordAcceptance(
  actor: Actor,
  args: {
    generation_id: string;
    accepted: boolean;
    // When `accepted`, which fields the reviewer kept. Setting any of them
    // flips `ai_assisted` on the accomplishment so the publish gate kicks in.
    kept_fields?: Array<"title" | "body" | "why_it_matters" | "next_steps">;
  }
): Promise<{ ai_assisted: boolean }> {
  const orgId = new mongoose.Types.ObjectId(actor.organization_id);
  const row = await AiGeneration.findOne({
    _id: new mongoose.Types.ObjectId(args.generation_id),
    organization_id: orgId,
  });
  if (!row) throw new AppError("not_found", "generation not found");
  if (row.purpose !== "accomplishment.draft" || !row.entity_id)
    throw new AppError("conflict", "generation is not an accomplishment draft");

  row.accepted = args.accepted;
  await row.save();

  if (!args.accepted || !args.kept_fields || args.kept_fields.length === 0) {
    return { ai_assisted: false };
  }

  const acc = await Accomplishment.findOne({ _id: row.entity_id, organization_id: orgId });
  if (!acc) throw new AppError("not_found", "accomplishment not found");

  acc.ai_assisted = true;
  if (!acc.ai_generation_ids.some((x: mongoose.Types.ObjectId) => x.equals(row._id))) {
    acc.ai_generation_ids.push(row._id);
  }
  acc.version += 1;
  await acc.save();
  return { ai_assisted: true };
}

// -------- Operator log (founder-only; policy enforces) ----------------------

export async function listAiLogs(
  actor: Actor,
  opts: { limit?: number; cursor?: string }
): Promise<{ items: AiGenerationDoc[]; next_cursor: string | null }> {
  if (!can(actor, "ai.read_log")) throw new AppError("forbidden", "cannot read AI log");
  const orgId = new mongoose.Types.ObjectId(actor.organization_id);
  const q: Record<string, unknown> = { organization_id: orgId };
  if (opts.cursor) q._id = { $lt: new mongoose.Types.ObjectId(opts.cursor) };
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
  const items = await AiGeneration.find(q)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean<AiGenerationDoc[]>();
  const next_cursor = items.length > limit ? items[limit - 1]!._id.toString() : null;
  return { items: items.slice(0, limit), next_cursor };
}
