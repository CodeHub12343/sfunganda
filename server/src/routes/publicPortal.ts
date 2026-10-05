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
  asyncHandler(async (_req, res) => {
    const data = await publicFinanceSummary();
    withCache(res, ["public:finance", "public:transparency"]);
    res.json({ data });
  })
);

router.get(
  "/finance/projects/:slug",
  asyncHandler(async (req, res) => {
    const data = await publicProjectFunding(req.params.slug);
    if (!data) {
      res.status(404).json({ error: { code: "not_found", message: "not found" } });
      return;
    }
    withCache(res, ["public:finance", `public:finance:project:${req.params.slug}`]);
    res.json({ data });
  })
);

export default router;
