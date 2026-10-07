import { Router } from "express";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { asyncHandler } from "./_shared.js";
import { AppError } from "@/util/errors.js";
import {
  Fund,
  Organization,
  BeneficiaryFundSummary,
} from "@/models/index.js";
import { env } from "@/config/env.js";

// =============================================================================
// Phase 11 — Public children's-fund summary (§13.7).
//
// This file imports from the MAIN DB only. It does NOT import anything
// from `@/beneficiary/*`. The invariant "no query path from a public
// endpoint to the private database" is checked statically in the C5 test
// by scanning this folder's imports.
//
// Returns totals and a count, suppressing both when the beneficiary count
// is below BENEFICIARY_SUPPRESSION_K (k-anonymity). No individual
// beneficiary data is ever exposed.
// =============================================================================

const router = Router();
const limiter = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false });

router.get(
  "/summary",
  limiter,
  asyncHandler(async (req, res) => {
    const tenant = (req as unknown as { org?: { id: mongoose.Types.ObjectId } }).org;
    const org = tenant
      ? await Organization.findById(tenant.id).lean()
      : await Organization.findOne().sort({ _id: 1 }).lean();
    if (!org) throw new AppError("not_found", "no organization");

    // Identify the children's fund by its restriction.purpose on the
    // public Fund collection — the beneficiary service rejects writes
    // to any other fund, so this is the authoritative name here too.
    const fund = await Fund.findOne({
      organization_id: org._id as mongoose.Types.ObjectId,
      kind: "restricted",
      "restriction.purpose": { $regex: "children", $options: "i" },
      active: true,
    }).lean();
    if (!fund) {
      res.setHeader("cache-control", "public, max-age=60, s-maxage=120");
      res.json({
        data: {
          enabled: false,
          suppressed: true,
          reason: "no children's fund configured",
        },
      });
      return;
    }

    const row = await BeneficiaryFundSummary.findOne({
      organization_id: org._id,
      public_fund_id: fund._id,
    }).lean();

    const k = env.BENEFICIARY_SUPPRESSION_K;
    res.setHeader("cache-control", "public, max-age=300, s-maxage=600");

    if (!row) {
      res.json({
        data: {
          enabled: true,
          suppressed: true,
          reason: "no activity yet",
          base_currency: fund.base_currency,
          threshold: k,
          updated_at: null,
        },
      });
      return;
    }
    if (row.beneficiary_count < k) {
      res.json({
        data: {
          enabled: true,
          suppressed: true,
          reason: `below suppression threshold (k=${k})`,
          base_currency: row.base_currency,
          threshold: k,
          updated_at: row.updated_at,
        },
      });
      return;
    }
    res.json({
      data: {
        enabled: true,
        suppressed: false,
        base_currency: row.base_currency,
        total_in_cents: row.total_in_cents,
        total_out_cents: row.total_out_cents,
        balance_cents: row.balance_cents,
        beneficiary_count: row.beneficiary_count,
        threshold: k,
        updated_at: row.updated_at,
      },
    });
  })
);

export default router;
