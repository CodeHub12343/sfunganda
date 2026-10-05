import mongoose from "mongoose";
import {
  Accomplishment,
  Community,
  MediaAsset,
  Project,
  ProjectCategory,
  ProjectMilestone,
} from "@/models/index.js";
import type { AccomplishmentDoc } from "@/models/Accomplishment.js";
import type { ProjectDoc } from "@/models/Project.js";
import { AppError } from "@/util/errors.js";
import { resolveAssetUrl } from "./signedUrls.js";
import { aggregatePublic } from "./metrics.js";

// ============================================================================
// Public projections. These are the ONLY code paths that the public site
// reads from. Anything not published, not public, or soft-deleted MUST
// resolve to 404 at the service layer (defence in depth; the policy layer
// also forbids it).
// ============================================================================

export type PublicAccomplishment = {
  public_id: string;
  title: string;
  summary: string;
  body_markdown: string;
  occurred_on: string;
  published_at: string;
  project: { slug: string; name: string };
  community: { slug: string; name: string; region_label: string };
  location_label: string | null;
  beneficiary_count: number | null;
  media: Array<{ id: string; url: string; kind: string; alt: string | null; width: number | null; height: number | null }>;
};

async function primaryOrg(): Promise<string> {
  const org = await mongoose.connection.db!.collection("organizations").findOne({}, { projection: { _id: 1 } });
  if (!org) throw new AppError("not_found", "no organization");
  return org._id.toString();
}

async function hydrateMedia(assetIds: mongoose.Types.ObjectId[]) {
  if (assetIds.length === 0) return [];
  const docs = await MediaAsset.find({
    _id: { $in: assetIds },
    status: "ready",
    visibility: "public",
  }).lean();
  const out: PublicAccomplishment["media"] = [];
  for (const d of docs) {
    try {
      const url = await resolveAssetUrl(d);
      out.push({
        id: d._id.toString(),
        url: url.url,
        kind: d.kind,
        alt: d.alt_text,
        width: d.width,
        height: d.height,
      });
    } catch {
      // Skip assets we can't sign — defensive; keep page rendering.
    }
  }
  return out;
}

export async function listPublicAccomplishments(opts: {
  limit?: number;
  cursor?: string;
  project_slug?: string;
  community_slug?: string;
}): Promise<{ items: PublicAccomplishment[]; next_cursor: string | null; cache_tags: string[] }> {
  const orgId = new mongoose.Types.ObjectId(await primaryOrg());
  const q: Record<string, unknown> = {
    organization_id: orgId,
    state: "published",
    public_id: { $type: "string" },
  };
  if (opts.project_slug) {
    const p = await Project.findOne({ organization_id: orgId, slug: opts.project_slug }).lean();
    if (!p) return { items: [], next_cursor: null, cache_tags: ["public:accomplishments"] };
    q.project_id = p._id;
  }
  if (opts.community_slug) {
    const c = await Community.findOne({ organization_id: orgId, slug: opts.community_slug }).lean();
    if (!c) return { items: [], next_cursor: null, cache_tags: ["public:accomplishments"] };
    const projects = await Project.find({ organization_id: orgId, community_id: c._id })
      .select({ _id: 1 })
      .lean();
    q.project_id = { $in: projects.map((p) => p._id) };
  }
  if (opts.cursor) q.published_at = { $lt: new Date(opts.cursor) };

  const limit = Math.min(50, Math.max(1, opts.limit ?? 20));
  const rows = await Accomplishment.find(q)
    .sort({ published_at: -1 })
    .limit(limit + 1)
    .lean<AccomplishmentDoc[]>();
  const next_cursor =
    rows.length > limit && rows[limit - 1]!.published_at
      ? rows[limit - 1]!.published_at!.toISOString()
      : null;
  const slice = rows.slice(0, limit);

  const projectIds = slice.map((r) => r.project_id);
  const projects = await Project.find({ _id: { $in: projectIds } }).lean();
  const projectMap = new Map(projects.map((p) => [p._id.toString(), p]));
  const communityIds = projects.map((p) => p.community_id);
  const communities = await Community.find({ _id: { $in: communityIds } }).lean();
  const communityMap = new Map(communities.map((c) => [c._id.toString(), c]));

  const items: PublicAccomplishment[] = [];
  for (const r of slice) {
    const p = projectMap.get(r.project_id.toString());
    if (!p) continue;
    const c = communityMap.get(p.community_id.toString());
    if (!c) continue;
    items.push({
      public_id: r.public_id!,
      title: r.title,
      summary: r.summary,
      body_markdown: r.body_markdown,
      occurred_on: r.occurred_on.toISOString(),
      published_at: r.published_at!.toISOString(),
      project: { slug: p.slug, name: p.name },
      community: { slug: c.slug, name: c.name, region_label: c.region_label },
      location_label: r.location_label,
      beneficiary_count: r.beneficiary_count,
      media: await hydrateMedia(r.media_asset_ids),
    });
  }
  return {
    items,
    next_cursor,
    cache_tags: ["public:accomplishments"],
  };
}

export async function getPublicAccomplishment(public_id: string): Promise<PublicAccomplishment> {
  const orgId = new mongoose.Types.ObjectId(await primaryOrg());
  const doc = await Accomplishment.findOne({
    organization_id: orgId,
    state: "published",
    public_id,
  }).lean<AccomplishmentDoc>();
  if (!doc) throw new AppError("not_found", "not published");
  const p = await Project.findById(doc.project_id).lean();
  if (!p) throw new AppError("not_found", "not published");
  const c = await Community.findById(p.community_id).lean();
  if (!c) throw new AppError("not_found", "not published");
  return {
    public_id: doc.public_id!,
    title: doc.title,
    summary: doc.summary,
    body_markdown: doc.body_markdown,
    occurred_on: doc.occurred_on.toISOString(),
    published_at: doc.published_at!.toISOString(),
    project: { slug: p.slug, name: p.name },
    community: { slug: c.slug, name: c.name, region_label: c.region_label },
    location_label: doc.location_label,
    beneficiary_count: doc.beneficiary_count,
    media: await hydrateMedia(doc.media_asset_ids),
  };
}

export type PublicProject = {
  slug: string;
  name: string;
  summary: string;
  description: string;
  status: ProjectDoc["status"];
  progress_pct: number;
  milestone_counts: ProjectDoc["milestone_counts"];
  category: { slug: string; name: string; color: string | null } | null;
  community: { slug: string; name: string; region_label: string };
  milestones: Array<{ title: string; status: string; due_on: string | null }>;
  recent_accomplishments: Array<{ public_id: string; title: string; published_at: string }>;
};

export async function listPublicProjects(): Promise<{
  items: Array<Omit<PublicProject, "milestones" | "recent_accomplishments">>;
  cache_tags: string[];
}> {
  const orgId = new mongoose.Types.ObjectId(await primaryOrg());
  const rows = await Project.find({
    organization_id: orgId,
    status: { $in: ["active", "completed", "paused"] },
  })
    .sort({ last_published_at: -1, updated_at: -1 })
    .limit(50)
    .lean<ProjectDoc[]>();
  const categoryIds = rows.map((r) => r.category_id).filter(Boolean) as mongoose.Types.ObjectId[];
  const categories = await ProjectCategory.find({ _id: { $in: categoryIds } }).lean();
  const catMap = new Map(categories.map((c) => [c._id.toString(), c]));
  const communities = await Community.find({ _id: { $in: rows.map((r) => r.community_id) } }).lean();
  const commMap = new Map(communities.map((c) => [c._id.toString(), c]));

  const items = rows.map((r) => {
    const cat = r.category_id ? catMap.get(r.category_id.toString()) : null;
    const c = commMap.get(r.community_id.toString())!;
    return {
      slug: r.slug,
      name: r.name,
      summary: r.summary,
      description: r.description,
      status: r.status,
      progress_pct: r.progress_pct,
      milestone_counts: r.milestone_counts,
      category: cat ? { slug: cat.slug, name: cat.name, color: cat.color } : null,
      community: { slug: c.slug, name: c.name, region_label: c.region_label },
    };
  });
  return { items, cache_tags: ["public:projects"] };
}

export async function getPublicProject(slug: string): Promise<PublicProject> {
  const orgId = new mongoose.Types.ObjectId(await primaryOrg());
  const p = await Project.findOne({
    organization_id: orgId,
    slug,
    status: { $in: ["active", "completed", "paused"] },
  }).lean<ProjectDoc>();
  if (!p) throw new AppError("not_found", "project not found");
  const c = await Community.findById(p.community_id).lean();
  if (!c) throw new AppError("not_found", "project not found");
  const cat = p.category_id ? await ProjectCategory.findById(p.category_id).lean() : null;
  const milestones = await ProjectMilestone.find({ project_id: p._id })
    .sort({ order: 1, _id: 1 })
    .lean();
  const recent = await Accomplishment.find({
    organization_id: orgId,
    project_id: p._id,
    state: "published",
  })
    .sort({ published_at: -1 })
    .limit(5)
    .lean();

  return {
    slug: p.slug,
    name: p.name,
    summary: p.summary,
    description: p.description,
    status: p.status,
    progress_pct: p.progress_pct,
    milestone_counts: p.milestone_counts,
    category: cat ? { slug: cat.slug, name: cat.name, color: cat.color } : null,
    community: { slug: c.slug, name: c.name, region_label: c.region_label },
    milestones: milestones.map((m) => ({
      title: m.title,
      status: m.status,
      due_on: m.due_on ? m.due_on.toISOString() : null,
    })),
    recent_accomplishments: recent.map((a) => ({
      public_id: a.public_id!,
      title: a.title,
      published_at: a.published_at!.toISOString(),
    })),
  };
}

export async function listPublicCommunities(): Promise<{
  items: Array<{
    slug: string;
    name: string;
    region_label: string;
    summary: string;
    active_projects: number;
  }>;
  cache_tags: string[];
}> {
  const orgId = new mongoose.Types.ObjectId(await primaryOrg());
  const comms = await Community.find({ organization_id: orgId, status: "active" }).lean();
  const items = await Promise.all(
    comms.map(async (c) => {
      const active_projects = await Project.countDocuments({
        organization_id: orgId,
        community_id: c._id,
        status: { $in: ["active", "completed", "paused"] },
      });
      return {
        slug: c.slug,
        name: c.name,
        region_label: c.region_label,
        summary: c.summary,
        active_projects,
      };
    })
  );
  return { items, cache_tags: ["public:communities"] };
}

export async function publicImpact(): Promise<{
  totals: { projects: number; communities: number; accomplishments: number };
  metrics: Array<{ key: string; label: string; unit: string; value: number }>;
  cache_tags: string[];
}> {
  const orgIdStr = await primaryOrg();
  const orgId = new mongoose.Types.ObjectId(orgIdStr);
  const [projects, communities, accomplishments] = await Promise.all([
    Project.countDocuments({ organization_id: orgId, status: { $in: ["active", "completed"] } }),
    Community.countDocuments({ organization_id: orgId, status: "active" }),
    Accomplishment.countDocuments({ organization_id: orgId, state: "published" }),
  ]);
  const metrics = await aggregatePublic(orgIdStr);
  return {
    totals: { projects, communities, accomplishments },
    metrics: metrics.map((m) => ({ key: m.key, label: m.label, unit: m.unit, value: m.value })),
    cache_tags: ["public:impact", "public:home"],
  };
}
