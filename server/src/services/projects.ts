import mongoose from "mongoose";
import { Project, ProjectCategory, ProjectMilestone } from "@/models/index.js";
import type { ProjectDoc, ProjectStatus } from "@/models/Project.js";
import type { ProjectMilestoneDoc, MilestoneStatus } from "@/models/ProjectMilestone.js";
import { AppError } from "@/util/errors.js";
import { can, type Actor } from "@/policy/index.js";

export type ProjectInput = {
  name: string;
  slug: string;
  community_id: string;
  category_id?: string;
  summary: string;
  description?: string;
  status?: ProjectStatus;
  starts_on?: string;
  ends_on?: string;
  budget_cents?: number;
  base_currency?: string;
  target_beneficiaries?: number;
};

function toDate(s?: string): Date | null {
  return s ? new Date(s + (s.length === 10 ? "T00:00:00Z" : "")) : null;
}

export async function createProject(actor: Actor, input: ProjectInput): Promise<ProjectDoc> {
  if (!can(actor, "projects.create")) throw new AppError("forbidden", "cannot create projects");
  const orgId = new mongoose.Types.ObjectId(actor.organization_id);
  try {
    const doc = await Project.create({
      organization_id: orgId,
      community_id: new mongoose.Types.ObjectId(input.community_id),
      category_id: input.category_id ? new mongoose.Types.ObjectId(input.category_id) : null,
      name: input.name,
      slug: input.slug.toLowerCase(),
      summary: input.summary,
      description: input.description ?? "",
      status: input.status ?? "planning",
      starts_on: toDate(input.starts_on),
      ends_on: toDate(input.ends_on),
      budget_cents: input.budget_cents ?? null,
      base_currency: input.base_currency ?? null,
      target_beneficiaries: input.target_beneficiaries ?? null,
      created_by: new mongoose.Types.ObjectId(actor.user_id),
    });
    return doc.toObject();
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      throw new AppError("conflict", "a project with that slug already exists", {
        fields: { slug: "already in use" },
      });
    }
    throw err;
  }
}

export async function updateProject(
  actor: Actor,
  id: string,
  patch: Partial<ProjectInput> & { version: number }
): Promise<ProjectDoc> {
  if (!can(actor, "projects.update")) throw new AppError("forbidden", "cannot update projects");
  const orgId = new mongoose.Types.ObjectId(actor.organization_id);
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.slug !== undefined) update.slug = patch.slug.toLowerCase();
  if (patch.summary !== undefined) update.summary = patch.summary;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.starts_on !== undefined) update.starts_on = toDate(patch.starts_on);
  if (patch.ends_on !== undefined) update.ends_on = toDate(patch.ends_on);
  if (patch.budget_cents !== undefined) update.budget_cents = patch.budget_cents;
  if (patch.base_currency !== undefined) update.base_currency = patch.base_currency;
  if (patch.target_beneficiaries !== undefined)
    update.target_beneficiaries = patch.target_beneficiaries;
  if (patch.community_id !== undefined)
    update.community_id = new mongoose.Types.ObjectId(patch.community_id);
  if (patch.category_id !== undefined)
    update.category_id = patch.category_id ? new mongoose.Types.ObjectId(patch.category_id) : null;

  const next = await Project.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(id), organization_id: orgId, version: patch.version },
    { $set: update, $inc: { version: 1 } },
    { new: true }
  ).lean();
  if (!next) {
    const exists = await Project.findOne({ _id: id, organization_id: orgId }).lean();
    throw new AppError(exists ? "version_conflict" : "not_found", exists ? "project changed since you loaded it" : "project not found");
  }
  return next as ProjectDoc;
}

export async function listProjects(
  actor: Actor,
  opts: { community_id?: string; status?: ProjectStatus; cursor?: string; limit?: number }
): Promise<{ items: ProjectDoc[]; next_cursor: string | null }> {
  if (!can(actor, "projects.read")) throw new AppError("forbidden", "cannot list projects");
  const q: Record<string, unknown> = {
    organization_id: new mongoose.Types.ObjectId(actor.organization_id),
  };
  if (opts.community_id) q.community_id = new mongoose.Types.ObjectId(opts.community_id);
  if (opts.status) q.status = opts.status;
  if (opts.cursor) q._id = { $lt: new mongoose.Types.ObjectId(opts.cursor) };
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
  const items = await Project.find(q).sort({ _id: -1 }).limit(limit + 1).lean<ProjectDoc[]>();
  const next_cursor = items.length > limit ? items[limit - 1]!._id.toString() : null;
  return { items: items.slice(0, limit), next_cursor };
}

export async function getProject(actor: Actor, id: string): Promise<ProjectDoc> {
  if (!can(actor, "projects.read")) throw new AppError("forbidden", "cannot read project");
  const doc = await Project.findOne({
    _id: new mongoose.Types.ObjectId(id),
    organization_id: new mongoose.Types.ObjectId(actor.organization_id),
  }).lean<ProjectDoc>();
  if (!doc) throw new AppError("not_found", "project not found");
  return doc;
}

// ---- Milestones ------------------------------------------------------------

export async function createMilestone(
  actor: Actor,
  input: {
    project_id: string;
    title: string;
    description?: string;
    due_on?: string;
    status?: MilestoneStatus;
    weight?: number;
    order?: number;
  }
): Promise<ProjectMilestoneDoc> {
  if (!can(actor, "projects.update")) throw new AppError("forbidden", "cannot add milestones");
  const orgId = new mongoose.Types.ObjectId(actor.organization_id);
  const project = await Project.findOne({ _id: input.project_id, organization_id: orgId }).lean();
  if (!project) throw new AppError("not_found", "project not found");
  const doc = await ProjectMilestone.create({
    organization_id: orgId,
    project_id: new mongoose.Types.ObjectId(input.project_id),
    title: input.title,
    description: input.description ?? "",
    due_on: toDate(input.due_on),
    status: input.status ?? "planned",
    weight: input.weight ?? 1,
    order: input.order ?? 0,
  });
  await recalculateProjectProgress(input.project_id, orgId);
  return doc.toObject();
}

export async function updateMilestone(
  actor: Actor,
  id: string,
  patch: Partial<{
    title: string;
    description: string;
    due_on: string;
    status: MilestoneStatus;
    weight: number;
    order: number;
    version: number;
  }>
): Promise<ProjectMilestoneDoc> {
  if (!can(actor, "projects.update")) throw new AppError("forbidden", "cannot edit milestones");
  const orgId = new mongoose.Types.ObjectId(actor.organization_id);
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.due_on !== undefined) update.due_on = toDate(patch.due_on);
  if (patch.status !== undefined) {
    update.status = patch.status;
    update.completed_at = patch.status === "complete" ? new Date() : null;
  }
  if (patch.weight !== undefined) update.weight = patch.weight;
  if (patch.order !== undefined) update.order = patch.order;

  const next = await ProjectMilestone.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(id), organization_id: orgId, version: patch.version ?? 0 },
    { $set: update, $inc: { version: 1 } },
    { new: true }
  );
  if (!next) {
    const exists = await ProjectMilestone.findOne({ _id: id, organization_id: orgId }).lean();
    throw new AppError(
      exists ? "version_conflict" : "not_found",
      exists ? "milestone changed since you loaded it" : "milestone not found"
    );
  }
  await recalculateProjectProgress(next.project_id.toString(), orgId);
  return next.toObject();
}

export async function listMilestones(
  actor: Actor,
  project_id: string
): Promise<ProjectMilestoneDoc[]> {
  if (!can(actor, "projects.read")) throw new AppError("forbidden", "cannot list milestones");
  return ProjectMilestone.find({
    organization_id: new mongoose.Types.ObjectId(actor.organization_id),
    project_id: new mongoose.Types.ObjectId(project_id),
  })
    .sort({ order: 1, _id: 1 })
    .lean<ProjectMilestoneDoc[]>();
}

// Progress is a weighted percentage: complete milestones contribute their
// full weight; in_progress contributes 50%; cancelled is excluded entirely.
export async function recalculateProjectProgress(
  project_id: string,
  organization_id: mongoose.Types.ObjectId
): Promise<void> {
  const rows = await ProjectMilestone.find({
    organization_id,
    project_id: new mongoose.Types.ObjectId(project_id),
    status: { $ne: "cancelled" },
  }).lean<ProjectMilestoneDoc[]>();
  let total = 0;
  let earned = 0;
  let complete = 0;
  let inProgress = 0;
  for (const m of rows) {
    total += m.weight;
    if (m.status === "complete") {
      earned += m.weight;
      complete++;
    } else if (m.status === "in_progress") {
      earned += m.weight * 0.5;
      inProgress++;
    }
  }
  const pct = total === 0 ? 0 : Math.round((earned / total) * 100);
  await Project.updateOne(
    { _id: new mongoose.Types.ObjectId(project_id) },
    {
      $set: {
        progress_pct: pct,
        "milestone_counts.total": rows.length,
        "milestone_counts.complete": complete,
        "milestone_counts.in_progress": inProgress,
      },
    }
  );
}

// ---- Categories ------------------------------------------------------------

export async function listCategories(
  actor: Actor
): Promise<Array<{ _id: mongoose.Types.ObjectId; name: string; slug: string; color: string | null }>> {
  if (!can(actor, "projects.read")) throw new AppError("forbidden", "cannot list categories");
  return ProjectCategory.find({
    organization_id: new mongoose.Types.ObjectId(actor.organization_id),
  })
    .sort({ name: 1 })
    .lean();
}
