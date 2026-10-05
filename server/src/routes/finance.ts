import { Router } from "express";
import mongoose from "mongoose";
import { asyncHandler, auth, parseBody } from "./_shared.js";
import {
  expenseCategoryBody,
  financialDocumentBody,
  fundCreateBody,
  transactionActionBody,
  transactionCreateBody,
} from "@shared/schemas/finance.js";
import {
  actOnTransaction,
  attachDocument,
  createDraft,
  listTransactions,
} from "@/services/finance.js";
import {
  ExpenseCategory,
  FinancialDocument,
  FinancialTransaction,
  Fund,
  LedgerEntry,
} from "@/models/index.js";
import { AppError } from "@/util/errors.js";
import { can } from "@/policy/index.js";

const router = Router();

// ---- Funds ----------------------------------------------------------------
router.get(
  "/funds",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    if (!can(a.actor, "finance.read", { kind: "finance", organization_id: a.actor.organization_id }))
      throw new AppError("forbidden", "cannot read funds");
    const items = await Fund.find({
      organization_id: new mongoose.Types.ObjectId(a.actor.organization_id),
    })
      .sort({ name: 1 })
      .lean();
    res.json({ data: items });
  })
);

router.post(
  "/funds",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    if (!can(a.actor, "finance.write", { kind: "finance", organization_id: a.actor.organization_id }))
      throw new AppError("forbidden", "cannot create funds");
    const body = parseBody(fundCreateBody, req.body);
    try {
      const doc = await Fund.create({
        organization_id: new mongoose.Types.ObjectId(a.actor.organization_id),
        code: body.code,
        name: body.name,
        kind: body.kind,
        project_id: body.project_id ? new mongoose.Types.ObjectId(body.project_id) : null,
        base_currency: body.base_currency.toUpperCase(),
      });
      res.json({ data: { id: doc._id.toString(), code: doc.code } });
    } catch (err) {
      if ((err as { code?: number }).code === 11000)
        throw new AppError("conflict", "a fund with that code exists", { fields: { code: "taken" } });
      throw err;
    }
  })
);

// ---- Expense categories ---------------------------------------------------
router.get(
  "/expense-categories",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    if (!can(a.actor, "finance.read", { kind: "finance", organization_id: a.actor.organization_id }))
      throw new AppError("forbidden", "cannot read categories");
    const items = await ExpenseCategory.find({
      organization_id: new mongoose.Types.ObjectId(a.actor.organization_id),
      retired_at: null,
    })
      .sort({ name: 1 })
      .lean();
    res.json({ data: items });
  })
);

router.post(
  "/expense-categories",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    if (!can(a.actor, "finance.write", { kind: "finance", organization_id: a.actor.organization_id }))
      throw new AppError("forbidden", "cannot create categories");
    const body = parseBody(expenseCategoryBody, req.body);
    try {
      const doc = await ExpenseCategory.create({
        organization_id: new mongoose.Types.ObjectId(a.actor.organization_id),
        slug: body.slug,
        name: body.name,
        description: body.description ?? "",
      });
      res.json({ data: { id: doc._id.toString(), slug: doc.slug } });
    } catch (err) {
      if ((err as { code?: number }).code === 11000)
        throw new AppError("conflict", "slug taken", { fields: { slug: "taken" } });
      throw err;
    }
  })
);

// ---- Transactions ---------------------------------------------------------
router.get(
  "/transactions",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const data = await listTransactions(a.actor, {
      state: typeof req.query.state === "string" ? (req.query.state as never) : undefined,
      kind: typeof req.query.kind === "string" ? (req.query.kind as never) : undefined,
      project_id: typeof req.query.project_id === "string" ? req.query.project_id : undefined,
      cursor: typeof req.query.cursor === "string" ? req.query.cursor : undefined,
      limit: typeof req.query.limit === "string" ? Number(req.query.limit) : undefined,
    });
    res.json({ data });
  })
);

router.post(
  "/transactions",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(transactionCreateBody, req.body);
    const doc = await createDraft(a.actor, {
      ...body,
      lines: body.lines.map((l) => ({
        ...l,
        project_id: l.project_id ?? undefined,
        expense_category_id: l.expense_category_id ?? undefined,
      })),
    });
    res.json({ data: { id: doc._id.toString(), version: doc.version, state: doc.state } });
  })
);

router.get(
  "/transactions/:id",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    if (!can(a.actor, "finance.read", { kind: "finance", organization_id: a.actor.organization_id }))
      throw new AppError("forbidden", "cannot read transactions");
    const doc = await FinancialTransaction.findOne({
      _id: new mongoose.Types.ObjectId(req.params.id),
      organization_id: new mongoose.Types.ObjectId(a.actor.organization_id),
    }).lean();
    if (!doc) throw new AppError("not_found", "not found");
    const entries = await LedgerEntry.find({ transaction_id: doc._id })
      .sort({ seq: 1 })
      .lean();
    res.json({ data: { doc, entries } });
  })
);

router.post(
  "/transactions/:id/action",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    const body = parseBody(transactionActionBody, req.body);
    const doc = await actOnTransaction(a.actor, req.params.id, body.action, {
      version: body.version,
      reason: body.reason,
      stepup_token: body.stepup_token,
    });
    res.json({ data: { id: doc._id.toString(), state: doc.state, version: doc.version, public_id: doc.public_id } });
  })
);

// ---- Documents ------------------------------------------------------------
router.post(
  "/documents",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    if (!can(a.actor, "finance.write", { kind: "finance", organization_id: a.actor.organization_id }))
      throw new AppError("forbidden", "cannot upload documents");
    const body = parseBody(financialDocumentBody, req.body);
    const doc = await FinancialDocument.create({
      organization_id: new mongoose.Types.ObjectId(a.actor.organization_id),
      kind: body.kind,
      media_asset_id: new mongoose.Types.ObjectId(body.media_asset_id),
      label: body.label,
      issuer: body.issuer ?? null,
      issued_on: body.issued_on ? new Date(body.issued_on) : null,
      reference_no: body.reference_no ?? null,
      transaction_ids: (body.transaction_ids ?? []).map((t) => new mongoose.Types.ObjectId(t)),
      uploaded_by: new mongoose.Types.ObjectId(a.actor.user_id),
    });
    for (const t of body.transaction_ids ?? []) {
      await attachDocument(a.actor, t, doc._id.toString());
    }
    res.json({ data: { id: doc._id.toString() } });
  })
);

router.post(
  "/transactions/:id/documents/:doc_id",
  asyncHandler(async (req, res) => {
    const a = auth(req);
    await attachDocument(a.actor, req.params.id, req.params.doc_id);
    res.json({ data: { ok: true } });
  })
);

export default router;
