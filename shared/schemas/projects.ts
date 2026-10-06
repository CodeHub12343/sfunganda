import { z } from "zod";
import { nonEmpty, objectId, slug } from "./common.js";

export const projectStatus = z.enum(["planning", "active", "paused", "completed", "archived"]);
export type ProjectStatus = z.infer<typeof projectStatus>;

export const milestoneStatus = z.enum(["planned", "in_progress", "complete", "cancelled"]);
export type MilestoneStatus = z.infer<typeof milestoneStatus>;

export const communityCreateBody = z.object({
  name: nonEmpty(160),
  slug: slug,
  region_label: nonEmpty(160),
  summary: z.string().max(2000).optional(),
});
export type CommunityCreateBody = z.infer<typeof communityCreateBody>;

export const projectCategoryBody = z.object({
  name: nonEmpty(120),
  slug: slug,
  color: z
    .string()
    .regex(/^#?[0-9a-f]{6}$/i)
    .optional(),
  description: z.string().max(1000).optional(),
});

export const projectCreateBody = z.object({
  name: nonEmpty(200),
  slug: slug,
  community_id: objectId,
  category_id: objectId.optional(),
  summary: z.string().max(500),
  description: z.string().max(10_000).optional(),
  status: projectStatus.default("planning"),
  starts_on: z.string().date().optional(),
  ends_on: z.string().date().optional(),
  budget_cents: z.number().int().nonnegative().optional(),
  base_currency: z.string().length(3).optional(),
  target_beneficiaries: z.number().int().nonnegative().optional(),
});
export type ProjectCreateBody = z.infer<typeof projectCreateBody>;

export const projectUpdateBody = projectCreateBody.partial().extend({
  version: z.number().int().min(0),
});

export const milestoneBody = z.object({
  project_id: objectId,
  title: nonEmpty(200),
  description: z.string().max(2000).optional(),
  due_on: z.string().date().optional(),
  status: milestoneStatus.default("planned"),
  weight: z.number().int().min(1).max(100).default(1),
  order: z.number().int().min(0).default(0),
});
export type MilestoneBody = z.infer<typeof milestoneBody>;

export const milestoneUpdateBody = milestoneBody.partial().extend({
  version: z.number().int().min(0),
});
