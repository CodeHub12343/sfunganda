import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { asyncHandler, auth, parseBody } from "./_shared.js";
import {
  readOwnOrg,
  setDomains,
  setInterOrgSettings,
  updateOrgBranding,
} from "@/services/tenancy.js";
import {
  initiateTransfer,
  listReceiverOptions,
  listTransfers,
} from "@/services/interOrgTransfers.js";

const router = Router();
router.use(rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }));

// ---- Admin: read / update own organisation --------------------------------

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const org = await readOwnOrg(a.actor);
    res.json({
      data: {
        id: org._id.toString(),
        slug: org.slug,
        name: org.name,
        base_currency: org.base_currency,
        branding: org.branding,
        domains: org.domains,
        inter_org: org.inter_org,
      },
    });
  })
);

const brandingBody = z.object({
  display_name: z.string().max(200).optional(),
  tagline: z.string().max(300).optional(),
  hero_markdown: z.string().max(5000).optional(),
  accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  footer_line: z.string().max(300).optional(),
});

router.patch(
  "/branding",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(brandingBody, req.body);
    const org = await updateOrgBranding(a.actor, body);
    res.json({ data: { branding: org.branding, version: org.version } });
  })
);

router.patch(
  "/domains",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(
      z.object({ domains: z.array(z.string().max(253)).max(20) }),
      req.body
    );
    const org = await setDomains(a.actor, body.domains);
    res.json({ data: { domains: org.domains, version: org.version } });
  })
);

router.patch(
  "/inter-org",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(
      z.object({
        send_enabled: z.boolean().optional(),
        receive_enabled: z.boolean().optional(),
        allowed_recipient_slugs: z.array(z.string().max(64)).max(50).optional(),
      }),
      req.body
    );
    const org = await setInterOrgSettings(a.actor, body);
    res.json({ data: { inter_org: org.inter_org, version: org.version } });
  })
);

// ---- Admin: inter-org transfers -------------------------------------------

router.get(
  "/transfers/options",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const data = await listReceiverOptions(a.actor);
    res.json({ data });
  })
);

const transferBody = z.object({
  to_organization_slug: z.string().min(1).max(64),
  from_fund_id: z.string().min(1),
  to_fund_id: z.string().min(1),
  amount_cents: z.number().int().positive(),
  currency: z.string().length(3),
  memo: z.string().max(500).optional(),
  idempotency_key: z.string().min(8).max(80),
});

router.post(
  "/transfers",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(transferBody, req.body);
    const r = await initiateTransfer(a.actor, body);
    res.json({ data: r });
  })
);

router.get(
  "/transfers",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const rows = await listTransfers(a.actor);
    res.json({ data: rows });
  })
);

export default router;
