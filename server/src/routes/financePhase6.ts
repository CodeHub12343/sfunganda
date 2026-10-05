import { Router } from "express";
import mongoose from "mongoose";
import { asyncHandler, auth, parseBody } from "./_shared.js";
import {
  allocationBody,
  fundRestrictionBody,
  fxRateBody,
  loanCreateBody,
  loanRepaymentBody,
  offlineDonationBody,
  periodCreateBody,
  periodStatusBody,
  reconciliationCreateBody,
  reconciliationMatchBody,
  reconciliationStatusBody,
} from "@shared/schemas/finance-phase6.js";
import { createAllocationDraft } from "@/services/allocations.js";
import {
  listPeriods,
  openPeriod,
  setPeriodStatus,
} from "@/services/periods.js";
import { recordRate } from "@/services/fx.js";
import {
  createReconciliation,
  listReconciliations,
  matchLine,
  setStatus as setReconciliationStatus,
} from "@/services/reconciliation.js";
import { createLoan, listLoans, recordRepayment } from "@/services/loans.js";
import { recordOfflineDonation } from "@/services/offlineDonations.js";
import { Fund } from "@/models/index.js";
import { AppError } from "@/util/errors.js";
import { can } from "@/policy/index.js";

const router = Router();

// ---- Allocations ----------------------------------------------------------
router.post(
  "/allocations",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(allocationBody, req.body);
    const doc = await createAllocationDraft(a.actor, body);
    res.json({ data: { id: doc._id.toString(), state: doc.state, version: doc.version } });
  })
);

// ---- Periods --------------------------------------------------------------
router.get(
  "/periods",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : 24;
    const data = await listPeriods(a.actor, limit);
    res.json({ data });
  })
);

router.post(
  "/periods",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(periodCreateBody, req.body);
    const doc = await openPeriod(a.actor, body.code);
    res.json({ data: doc });
  })
);

router.post(
  "/periods/:code/status",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(periodStatusBody, req.body);
    const doc = await setPeriodStatus(a.actor, req.params.code, body.status, body.version);
    res.json({ data: doc });
  })
);

// ---- FX rates -------------------------------------------------------------
router.post(
  "/rates",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    if (!can(a.actor, "finance.write", { kind: "finance", organization_id: a.actor.organization_id }))
      throw new AppError("forbidden", "cannot record rates");
    const body = parseBody(fxRateBody, req.body);
    await recordRate(new mongoose.Types.ObjectId(a.actor.organization_id), {
      from: body.from,
      to: body.to,
      rate: body.rate,
      on_date: new Date(body.on_date),
      source: body.source,
    });
    res.json({ data: { ok: true } });
  })
);

// ---- Reconciliations ------------------------------------------------------
router.get(
  "/reconciliations",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const items = await listReconciliations(a.actor, {
      period_code: typeof req.query.period_code === "string" ? req.query.period_code : undefined,
      source: typeof req.query.source === "string" ? (req.query.source as never) : undefined,
      status: typeof req.query.status === "string" ? (req.query.status as never) : undefined,
      limit: typeof req.query.limit === "string" ? Number(req.query.limit) : undefined,
    });
    res.json({ data: items });
  })
);

router.post(
  "/reconciliations",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(reconciliationCreateBody, req.body);
    const doc = await createReconciliation(a.actor, body);
    res.json({ data: { id: doc._id.toString() } });
  })
);

router.patch(
  "/reconciliations/:id/lines/:index",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(reconciliationMatchBody, req.body);
    const doc = await matchLine(a.actor, req.params.id, Number(req.params.index), body);
    res.json({ data: { id: doc._id.toString(), version: doc.version, variance_cents: doc.variance_cents } });
  })
);

router.post(
  "/reconciliations/:id/status",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(reconciliationStatusBody, req.body);
    const doc = await setReconciliationStatus(a.actor, req.params.id, body.status, body.version);
    res.json({ data: { id: doc._id.toString(), status: doc.status, version: doc.version } });
  })
);

// ---- Loans ----------------------------------------------------------------
router.get(
  "/loans",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const items = await listLoans(a.actor);
    res.json({ data: items });
  })
);

router.post(
  "/loans",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(loanCreateBody, req.body);
    const doc = await createLoan(a.actor, body);
    res.json({ data: { id: doc._id.toString(), public_id: doc.public_id } });
  })
);

router.post(
  "/loans/:id/repayments",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(loanRepaymentBody, req.body);
    const doc = await recordRepayment(a.actor, req.params.id, body);
    res.json({ data: { id: doc._id.toString(), outstanding_cents: doc.outstanding_cents, status: doc.status } });
  })
);

// ---- Offline donations ----------------------------------------------------
router.post(
  "/offline-donations",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(offlineDonationBody, req.body);
    const doc = await recordOfflineDonation(a.actor, body);
    res.json({ data: { id: doc._id.toString(), public_id: doc.public_id, transaction_id: doc.transaction_id?.toString() ?? null } });
  })
);

// ---- Fund restriction management -----------------------------------------
router.put(
  "/funds/:id/restriction",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    if (!can(a.actor, "finance.write", { kind: "finance", organization_id: a.actor.organization_id }))
      throw new AppError("forbidden", "cannot edit restrictions");
    const body = parseBody(fundRestrictionBody, req.body);
    const orgId = new mongoose.Types.ObjectId(a.actor.organization_id);
    const result = await Fund.updateOne(
      { _id: new mongoose.Types.ObjectId(req.params.id), organization_id: orgId },
      {
        $set: {
          restriction: {
            purpose: body.purpose,
            allowed_expense_prefixes: body.allowed_expense_prefixes,
            allowed_project_ids: body.allowed_project_ids.map(
              (p) => new mongoose.Types.ObjectId(p)
            ),
            expires_on: body.expires_on ? new Date(body.expires_on) : null,
          },
        },
      }
    );
    if (result.matchedCount === 0) throw new AppError("not_found", "fund not found");
    res.json({ data: { ok: true } });
  })
);

router.delete(
  "/funds/:id/restriction",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    if (!can(a.actor, "finance.write", { kind: "finance", organization_id: a.actor.organization_id }))
      throw new AppError("forbidden", "cannot edit restrictions");
    const orgId = new mongoose.Types.ObjectId(a.actor.organization_id);
    await Fund.updateOne(
      { _id: new mongoose.Types.ObjectId(req.params.id), organization_id: orgId },
      { $set: { restriction: null } }
    );
    res.json({ data: { ok: true } });
  })
);

export default router;
