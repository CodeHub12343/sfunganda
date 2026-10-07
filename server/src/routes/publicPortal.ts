import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "./_shared.js";
import {
  getPublicAccomplishment,
  getPublicProject,
  listPublicAccomplishments,
  listPublicCommunities,
  listPublicProjects,
  publicImpact,
} from "@/services/publicRead.js";
import { publicFinanceSummary, publicProjectFunding } from "@/services/publicFinance.js";
import mongoose from "mongoose";
import { Business, Community } from "@/models/index.js";
import { AppError } from "@/util/errors.js";
import { publicSustainability, communityWithCoarseCoords } from "@/services/sustainability.js";
import { ImpactReport, ReportExport } from "@/models/index.js";
import { presignUrl } from "@/services/storage.js";

// Phase 13 â€” prefer the tenant resolved from the Host header. Falls
// back to the single-org heuristic so single-tenant installs continue
// to work.
async function primaryOrgId(req?: import("express").Request): Promise<mongoose.Types.ObjectId> {
  if (req) {
    const t = (req as unknown as { org?: { id: mongoose.Types.ObjectId } }).org;
    if (t) return t.id;
  }
  const org = await mongoose.connection.db!.collection("organizations").findOne({}, { projection: { _id: 1 } });
  if (!org) throw new AppError("not_found", "no organization");
  return org._id as mongoose.Types.ObjectId;
}

const router = Router();

const limiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

function withCache(res: import("express").Response, tags: string[], seconds = 300) {
  res.setHeader(
    "cache-control",
    `public, max-age=${Math.min(60, seconds)}, s-maxage=${seconds}, stale-while-revalidate=${seconds}`
  );
  if (tags.length > 0) res.setHeader("x-cache-tags", tags.join(","));
}

router.use(limiter);

router.get(
  "/accomplishments",
  asyncHandler(async (req, res) => {
    const data = await listPublicAccomplishments({
      limit: typeof req.query.limit === "string" ? Number(req.query.limit) : undefined,
      cursor: typeof req.query.cursor === "string" ? req.query.cursor : undefined,
      project_slug: typeof req.query.project === "string" ? req.query.project : undefined,
      community_slug: typeof req.query.community === "string" ? req.query.community : undefined,
    });
    withCache(res, data.cache_tags);
    res.json({ data: { items: data.items, next_cursor: data.next_cursor } });
  })
);

router.get(
  "/accomplishments/:public_id",
  asyncHandler(async (req, res) => {
    const doc = await getPublicAccomplishment(req.params.public_id);
    withCache(res, ["public:accomplishments", `public:accomplishment:${doc.public_id}`]);
    res.json({ data: doc });
  })
);

router.get(
  "/projects",
  asyncHandler(async (_req, res) => {
    const data = await listPublicProjects();
    withCache(res, data.cache_tags);
    res.json({ data: { items: data.items } });
  })
);

router.get(
  "/projects/:slug",
  asyncHandler(async (req, res) => {
    const doc = await getPublicProject(req.params.slug);
    withCache(res, ["public:projects", `public:project:${req.params.slug}`]);
    res.json({ data: doc });
  })
);

router.get(
  "/communities",
  asyncHandler(async (_req, res) => {
    const data = await listPublicCommunities();
    withCache(res, data.cache_tags);
    res.json({ data: { items: data.items } });
  })
);

router.get(
  "/impact",
  asyncHandler(async (_req, res) => {
    const data = await publicImpact();
    withCache(res, data.cache_tags);
    res.json({ data: { totals: data.totals, metrics: data.metrics } });
  })
);

router.get(
  "/finance",
  asyncHandler(async (req, res) => {
    const orgId = await primaryOrgId(req);
    const data = await publicFinanceSummary(orgId);
    withCache(res, ["public:finance", "public:transparency"]);
    res.json({ data });
  })
);

// Phase 8: sustainability. ?community=<slug> filters to a single community.
router.get(
  "/sustainability",
  asyncHandler(async (req, res) => {
    const orgId = await primaryOrgId(req);
    const community_slug = typeof req.query.community === "string" ? req.query.community : null;
    const months =
      typeof req.query.months === "string"
        ? req.query.months.split(",").map((s) => s.trim()).filter((s) => /^\d{4}-\d{2}$/.test(s)).slice(0, 24)
        : undefined;
    const data = await publicSustainability({ organization_id: orgId, community_slug, months });
    withCache(res, data.cache_tags, 600);
    // Expose a hand-verifiable response: ratio, components, and the actual
    // ledger rows the number came from so a visitor can audit the figure.
    res.json({
      data: {
        community: data.community,
        months: data.months.map((m) => ({
          month: m.month,
          revenue_base_cents: m.revenue_base_cents,
          operating_expense_base_cents: m.operating_expense_base_cents,
          ratio: m.ratio,
          revenue_rows: m.revenue_rows,
          expense_rows: m.expense_rows,
        })),
      },
    });
  })
);

// Phase 8: public businesses â€” only `public_visibility: "public"`, status in
// {active, paused}. Coarse coordinates come from the parent community.
router.get(
  "/businesses",
  asyncHandler(async (_req, res) => {
    const orgId = await primaryOrgId(req);
    const [bizs, comms] = await Promise.all([
      Business.find({
        organization_id: orgId,
        public_visibility: "public",
        status: { $in: ["active", "paused"] },
      }).lean(),
      Community.find({ organization_id: orgId, status: "active" }).lean(),
    ]);
    const commBySlug = new Map(comms.map((c) => [c._id.toString(), c]));
    withCache(res, ["public:businesses"], 600);
    res.json({
      data: {
        items: bizs.map((b) => {
          const c = b.community_id ? commBySlug.get(b.community_id.toString()) : null;
          return {
            slug: b.slug,
            name: b.name,
            kind: b.kind,
            summary: b.summary,
            community: c
              ? {
                  slug: c.slug,
                  name: c.name,
                  region_label: c.region_label,
                }
              : null,
          };
        }),
      },
    });
  })
);

router.get(
  "/communities/:slug",
  asyncHandler(async (req, res) => {
    const orgId = await primaryOrgId(req);
    const r = await communityWithCoarseCoords(orgId, req.params.slug);
    if (!r) {
      res.status(404).json({ error: { code: "not_found", message: "not found" } });
      return;
    }
    withCache(res, ["public:communities", `public:community:${r.slug}`], 600);
    res.json({ data: r });
  })
);

// Phase 9: public reports archive. Only `published` reports; archived
// disappear from the public list but their files still resolve via the
// presigned URL (so a reader with the direct link isn't broken when the
// report rotates out of the archive).
router.get(
  "/reports",
  asyncHandler(async (_req, res) => {
    const orgId = await primaryOrgId(req);
    const rows = await ImpactReport.find({
      organization_id: orgId,
      state: "published",
      latest_export_id: { $ne: null },
    })
      .sort({ published_at: -1 })
      .limit(100)
      .lean();
    withCache(res, ["public:reports"], 600);
    res.json({
      data: {
        items: rows.map((r) => ({
          id: r._id.toString(),
          period_kind: r.period_kind,
          period_code: r.period_code,
          title: r.title,
          published_at: r.published_at,
          content_hash: r.snapshot?.content_hash ?? null,
          download_path: `/reports/${r._id.toString()}/download`,
        })),
      },
    });
  })
);

router.get(
  "/reports/:id/download",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      res.status(404).json({ error: { code: "not_found", message: "not found" } });
      return;
    }
    const orgId = await primaryOrgId(req);
    const report = await ImpactReport.findOne({
      _id: new mongoose.Types.ObjectId(req.params.id),
      organization_id: orgId,
      state: { $in: ["published", "archived"] },
    }).lean();
    if (!report || !report.latest_export_id) {
      res.status(404).json({ error: { code: "not_found", message: "not found" } });
      return;
    }
    const exp = await ReportExport.findOne({
      _id: report.latest_export_id,
      state: "ready",
    }).lean();
    if (!exp) {
      res.status(404).json({ error: { code: "not_found", message: "not found" } });
      return;
    }
    const url = presignUrl({
      bucket: exp.bucket,
      key: exp.key,
      method: "GET",
      ttlSeconds: 300,
      responseContentDisposition: `inline; filename="sarahs-foundation-${report.period_code}.pdf"`,
    });
    res.setHeader("cache-control", "private, no-store");
    res.json({ data: { url, expires_in: 300, pages: exp.pages, sha256: exp.sha256, tagged: exp.tagged } });
  })
);

router.get(
  "/finance/projects/:slug",
  asyncHandler(async (req, res) => {
    const orgId = await primaryOrgId(req);
    const data = await publicProjectFunding(String(req.params.slug ?? ""), orgId);
    if (!data) {
      res.status(404).json({ error: { code: "not_found", message: "not found" } });
      return;
    }
    withCache(res, ["public:finance", `public:finance:project:${req.params.slug}`]);
    res.json({ data });
  })
);

export default router;
