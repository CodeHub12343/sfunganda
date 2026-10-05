import { z } from "zod";
import { nonEmpty, objectId } from "./common.js";

export const accomplishmentState = z.enum([
  "draft",
  "submitted",
  "in_review",
  "changes_requested",
  "approved",
  "published",
  "rejected",
  "archived",
]);
export type AccomplishmentState = z.infer<typeof accomplishmentState>;

export const accomplishmentBody = z.object({
  project_id: objectId,
  milestone_id: objectId.optional(),
  title: nonEmpty(200),
  summary: nonEmpty(500),
  body_markdown: z.string().max(20_000),
  occurred_on: z.string().date(),
  beneficiary_count: z.number().int().nonnegative().optional(),
  location_label: z.string().max(160).optional(),
  // Attached media (already uploaded via Phase 2 — these are MediaAsset ids).
  media_asset_ids: z.array(objectId).max(20).optional(),
  // Metric entries captured alongside this accomplishment.
  metrics: z
    .array(
      z.object({
        definition_id: objectId,
        value: z.number().finite(),
        unit: z.string().max(32).optional(),
      })
    )
    .max(20)
    .optional(),
});
export type AccomplishmentBody = z.infer<typeof accomplishmentBody>;

export const accomplishmentUpdateBody = accomplishmentBody.partial().extend({
  version: z.number().int().min(0),
});

export const approvalDecision = z.enum(["approve", "request_changes", "reject"]);
export type ApprovalDecision = z.infer<typeof approvalDecision>;

export const approvalBody = z.object({
  decision: approvalDecision,
  note: z.string().max(2000).optional(),
  // Safeguarding checklist — each item must be acknowledged on approve.
  safeguarding: z
    .object({
      consent_recorded: z.boolean(),
      no_minor_identifiers: z.boolean(),
      images_appropriate: z.boolean(),
      names_scrubbed: z.boolean(),
    })
    .optional(),
});
export type ApprovalBody = z.infer<typeof approvalBody>;

export const submitBody = z.object({
  version: z.number().int().min(0),
  note: z.string().max(1000).optional(),
});

export const metricDefinitionBody = z.object({
  key: z
    .string()
    .regex(/^[a-z0-9_]{2,40}$/i)
    .toLowerCase(),
  label: nonEmpty(120),
  unit: z.string().max(32),
  description: z.string().max(500).optional(),
  aggregate: z.enum(["sum", "avg", "max", "last"]).default("sum"),
  public: z.boolean().default(false),
});
export type MetricDefinitionBody = z.infer<typeof metricDefinitionBody>;
