import mongoose, { Schema } from "mongoose";

// =============================================================================
// AI generation log (§17.4). One row per provider call — accomplishment
// drafting, video transcription, summary, or translation.
//
// The row is written whether the output was accepted, edited, or discarded.
// Visible to founders only (enforced in the policy module).
// =============================================================================

export type AiPurpose =
  | "accomplishment.draft"
  | "video.summary"
  | "video.translate"
  | "video.transcribe";

export type AiEntityType = "accomplishment" | "video" | "media_asset";

export type AiValidationFinding = {
  kind: "unknown_number" | "unknown_date" | "unknown_name" | "unknown_place" | "length" | "format";
  span: string;
  field?: string;
};

export type AiValidationResult = {
  ok: boolean;
  findings: AiValidationFinding[];
  // Spans that must be highlighted to the reviewer. UI-friendly.
  highlights: Array<{ field: string; text: string; reason: string }>;
};

export type AiTokens = {
  input: number;
  output: number;
};

export type AiGenerationDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  purpose: AiPurpose;
  actor_id: mongoose.Types.ObjectId;
  entity_type: AiEntityType;
  entity_id: mongoose.Types.ObjectId | null;
  provider: string; // "anthropic" | "mock" | ...
  model: string;
  // Input the provider actually saw (after name masking, after beneficiary
  // scrubbing). This is the source of truth for the fact-check validators —
  // nothing may appear in `output` that is not in `input_snapshot`.
  input_snapshot: Record<string, unknown>;
  // Raw provider output (post-parse). May be null on timeout/failure.
  output: Record<string, unknown> | null;
  validation_result: AiValidationResult;
  // null = not yet decided (reviewer hasn't opened/finished). true = accepted
  // wholesale, false = edited or discarded. Set from the review action.
  accepted: boolean | null;
  tokens: AiTokens;
  latency_ms: number;
  error_code: string | null;
  error_message: string | null;
  created_at: Date;
};

const AiGenerationSchema = new Schema<AiGenerationDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    purpose: {
      type: String,
      enum: ["accomplishment.draft", "video.summary", "video.translate", "video.transcribe"],
      required: true,
    },
    actor_id: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    entity_type: { type: String, enum: ["accomplishment", "video", "media_asset"], required: true },
    entity_id: { type: Schema.Types.ObjectId, default: null },
    provider: { type: String, required: true, maxlength: 60 },
    model: { type: String, required: true, maxlength: 120 },
    input_snapshot: { type: Schema.Types.Mixed, required: true },
    output: { type: Schema.Types.Mixed, default: null },
    validation_result: {
      ok: { type: Boolean, required: true },
      findings: { type: [Schema.Types.Mixed], default: [] },
      highlights: { type: [Schema.Types.Mixed], default: [] },
    },
    accepted: { type: Boolean, default: null },
    tokens: {
      input: { type: Number, required: true, default: 0, min: 0 },
      output: { type: Number, required: true, default: 0, min: 0 },
    },
    latency_ms: { type: Number, required: true, default: 0, min: 0 },
    error_code: { type: String, default: null, maxlength: 60 },
    error_message: { type: String, default: null, maxlength: 500 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false }, collection: "ai_generations" }
);

AiGenerationSchema.index({ organization_id: 1, created_at: -1 });
AiGenerationSchema.index({ organization_id: 1, entity_type: 1, entity_id: 1, created_at: -1 });
AiGenerationSchema.index({ organization_id: 1, actor_id: 1, created_at: -1 });

export const AiGeneration =
  (mongoose.models.AiGeneration as mongoose.Model<AiGenerationDoc> | undefined) ?? mongoose.model<AiGenerationDoc>("AiGeneration", AiGenerationSchema);
