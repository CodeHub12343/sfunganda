import mongoose from "mongoose";
import { Project, ProjectFollow } from "@/models/index.js";
import { AppError } from "@/util/errors.js";

async function orgIdOf(user_organization_id: string): Promise<mongoose.Types.ObjectId> {
  return new mongoose.Types.ObjectId(user_organization_id);
}

export async function followProject(
  user_id: string,
  organization_id: string,
  project_id: string
): Promise<void> {
  const orgId = await orgIdOf(organization_id);
  const project = await Project.findOne({ _id: project_id, organization_id: orgId }).lean();
  if (!project) throw new AppError("not_found", "project not found");
  try {
    await ProjectFollow.create({
      organization_id: orgId,
      user_id: new mongoose.Types.ObjectId(user_id),
      project_id: new mongoose.Types.ObjectId(project_id),
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return; // already followed
    throw err;
  }
}

export async function unfollowProject(
  user_id: string,
  organization_id: string,
  project_id: string
): Promise<void> {
  await ProjectFollow.deleteOne({
    organization_id: new mongoose.Types.ObjectId(organization_id),
    user_id: new mongoose.Types.ObjectId(user_id),
    project_id: new mongoose.Types.ObjectId(project_id),
  });
}

export async function listMyFollows(
  user_id: string,
  organization_id: string
): Promise<Array<{ _id: string; project: { _id: string; slug: string; name: string } }>> {
  const rows = await ProjectFollow.find({
    organization_id: new mongoose.Types.ObjectId(organization_id),
    user_id: new mongoose.Types.ObjectId(user_id),
  })
    .sort({ created_at: -1 })
    .lean();
  const projects = await Project.find({ _id: { $in: rows.map((r) => r.project_id) } })
    .select({ _id: 1, slug: 1, name: 1 })
    .lean();
  const byId = new Map(projects.map((p) => [p._id.toString(), p]));
  return rows
    .map((r) => {
      const p = byId.get(r.project_id.toString());
      if (!p) return null;
      return {
        _id: r._id.toString(),
        project: { _id: p._id.toString(), slug: p.slug, name: p.name },
      };
    })
    .filter((x): x is { _id: string; project: { _id: string; slug: string; name: string } } => !!x);
}

export async function listFollowerIds(
  organization_id: mongoose.Types.ObjectId,
  project_id: mongoose.Types.ObjectId
): Promise<mongoose.Types.ObjectId[]> {
  const rows = await ProjectFollow.find({ organization_id, project_id })
    .select({ user_id: 1 })
    .lean();
  return rows.map((r) => r.user_id);
}
