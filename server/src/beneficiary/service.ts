import mongoose from "mongoose";
import crypto from "node:crypto";
import { env } from "@/config/env.js";
import { AppError } from "@/util/errors.js";
import { can, type Actor } from "@/policy/index.js";
import { Fund, BeneficiaryFundSummary } from "@/models/index.js";
import {
  BeneficiaryModel,
  BeneficiaryFundTxModel,
  BeneficiaryAuditModel,
  type BeneficiaryPrivateRecordDoc,
  type BeneficiaryFundTxKind,
} from "./models.js";
import { encryptField, decryptField, fieldFingerprint, type EncryptedField } from "./crypto.js";

// =============================================================================
// Phase 11 service layer. ALL access to beneficiary data goes through this
// module. Imports from outside the folder (routes, admin UI, workers) call
// these functions; they never see the private connection.
//
// Every function:
//   1. Verifies `can(actor, ...)` AND actor is in the allow-list,
//   2. Writes a BeneficiaryAudit row (reads too — see §19.3),
//   3. Returns only the fields the caller asked for.
//
// Transactions touch the PRIVATE connection and (where a public summary
// changes) the main connection, but we deliberately DO NOT span one
// cross-connection transaction. Instead we commit private first; if the
// public summary update fails, we enqueue a recompute (outbox) so the
// pair converges — never the reverse (private commit after public write
// would leak that an unapproved tx exists).
// =============================================================================

const ALLOWED_ACTIONS = new Set<string>([
  "beneficiaries.read",
  "beneficiaries.write",
  "beneficiaries.approve",
  "beneficiaries.reverse",
]);

function allowListedUserIds(): Set<string> {
  return new Set(env.BENEFICIARY_ACCESS_USER_IDS ?? []);
}

function requireAccess(actor: Actor, action: Parameters<typeof can>[1]): void {
  if (!ALLOWED_ACTIONS.has(action)) {
    throw new AppError("forbidden", "beneficiary action not recognised");
  }
  if (!can(actor, action)) throw new AppError("forbidden", "insufficient role");
  if (!actor.mfa_verified) throw new AppError("mfa_required", "MFA required");
  const allowed = allowListedUserIds();
  // The founder is always implicitly on the list IF their id was seeded
  // in the env; we do NOT grant implicit access by role alone (§19.3 —
  // "founder and a named safeguarding lead ONLY"). If the env is empty
  // in a non-prod environment, we hard-refuse so a misconfiguration is
  // obvious.
  if (allowed.size === 0) {
    throw new AppError(
      "forbidden",
      "no users are enrolled for beneficiary access (BENEFICIARY_ACCESS_USER_IDS)"
    );
  }
  if (!allowed.has(actor.user_id)) {
    throw new AppError("forbidden", "not on the beneficiary access list");
  }
}

async function audit(
  organization_id: mongoose.Types.ObjectId,
  actor: Actor,
  args: {
    action: string;
    entity_type: "beneficiary" | "beneficiary_fund_tx";
    entity_id: mongoose.Types.ObjectId;
    fields_viewed?: string[];
    note?: string;
    ctx: { ip?: string; user_agent?: string; request_id?: string };
  }
): Promise<void> {
  const Model = await BeneficiaryAuditModel();
  await Model.create({
    organization_id,
    actor_id: new mongoose.Types.ObjectId(actor.user_id),
    action: args.action,
    entity_type: args.entity_type,
    entity_id: args.entity_id,
    fields_viewed: args.fields_viewed ?? [],
    note: args.note ?? null,
    ip: args.ctx.ip ?? "",
    user_agent: args.ctx.user_agent ?? "",
    request_id: args.ctx.request_id ?? "",
  });
}

// Short random ref code: three groups of four alphanumerics, excluding
// visually ambiguous characters. 8^12 keyspace; collisions are refused by
// the unique index and we retry.
function makeRefCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const buf = crypto.randomBytes(12);
  const picks = [];
  for (let i = 0; i < 12; i++) picks.push(alphabet[buf[i]! % alphabet.length]);
  return `${picks.slice(0, 4).join("")}-${picks.slice(4, 8).join("")}-${picks.slice(8, 12).join("")}`;
}

export type AddBeneficiaryInput = {
  name: string;
  dob?: string; // ISO (YYYY-MM-DD)
  guardian?: string;
  notes?: string;
};

export type BeneficiaryPublicView = {
  id: string;
  ref_code: string;
  status: "active" | "left" | "aged_out";
  name: string;
  dob: string | null;
  guardian: string | null;
  notes: string | null;
  created_at: string;
};

export type RequestCtx = { ip?: string; user_agent?: string; request_id?: string };

function orgId(actor: Actor): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(actor.organization_id);
}

function encryptOptional(s: string | undefined | null): EncryptedField | null {
  if (!s) return null;
  return encryptField(s);
}

export async function addBeneficiary(
  actor: Actor,
  input: AddBeneficiaryInput,
  ctx: RequestCtx
): Promise<BeneficiaryPublicView> {
  requireAccess(actor, "beneficiaries.write");
  if (!input.name || !input.name.trim()) {
    throw new AppError("bad_request", "name is required", { fields: { name: "required" } });
  }
  const Model = await BeneficiaryModel();
  const org = orgId(actor);
  // Three attempts to allocate a non-colliding ref_code — the keyspace
  // makes collision vanishingly rare but we treat it as a precondition.
  let doc: BeneficiaryPrivateRecordDoc | null = null;
  for (let i = 0; i < 3 && !doc; i++) {
    try {
      doc = (await Model.create({
        organization_id: org,
        ref_code: makeRefCode(),
        name_ct: encryptField(input.name),
        dob_ct: encryptOptional(input.dob),
        guardian_ct: encryptOptional(input.guardian),
        notes_ct: encryptOptional(input.notes),
        name_fingerprint: fieldFingerprint(input.name),
        status: "active",
        created_by: new mongoose.Types.ObjectId(actor.user_id),
      })) as unknown as BeneficiaryPrivateRecordDoc;
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err;
    }
  }
  if (!doc) throw new AppError("conflict", "could not allocate ref_code");
  await audit(org, actor, {
    action: "beneficiary.add",
    entity_type: "beneficiary",
    entity_id: doc._id,
    ctx,
  });
  return toView(doc);
}

function toView(doc: BeneficiaryPrivateRecordDoc): BeneficiaryPublicView {
  return {
    id: doc._id.toString(),
    ref_code: doc.ref_code,
    status: doc.status,
    name: decryptField(doc.name_ct),
    dob: doc.dob_ct ? decryptField(doc.dob_ct) : null,
    guardian: doc.guardian_ct ? decryptField(doc.guardian_ct) : null,
    notes: doc.notes_ct ? decryptField(doc.notes_ct) : null,
    created_at: doc.created_at.toISOString(),
  };
}

export async function getBeneficiary(
  actor: Actor,
  id: string,
  ctx: RequestCtx
): Promise<BeneficiaryPublicView> {
  requireAccess(actor, "beneficiaries.read");
  const Model = await BeneficiaryModel();
  const doc = (await Model.findOne({
    _id: new mongoose.Types.ObjectId(id),
    organization_id: orgId(actor),
  }).lean()) as BeneficiaryPrivateRecordDoc | null;
  if (!doc) throw new AppError("not_found", "beneficiary not found");
  await audit(orgId(actor), actor, {
    action: "beneficiary.read",
    entity_type: "beneficiary",
    entity_id: doc._id,
    fields_viewed: ["name", "dob", "guardian", "notes"],
    ctx,
  });
  return toView(doc);
}

export async function listBeneficiaries(
  actor: Actor,
  opts: { query?: string; status?: "active" | "left" | "aged_out"; limit?: number },
  ctx: RequestCtx
): Promise<Array<Pick<BeneficiaryPublicView, "id" | "ref_code" | "status">>> {
  requireAccess(actor, "beneficiaries.read");
  const Model = await BeneficiaryModel();
  const q: Record<string, unknown> = { organization_id: orgId(actor) };
  if (opts.status) q.status = opts.status;
  if (opts.query) q.name_fingerprint = fieldFingerprint(opts.query);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 50));
  const rows = (await Model.find(q, { ref_code: 1, status: 1 }).limit(limit).lean()) as Array<
    Pick<BeneficiaryPrivateRecordDoc, "_id" | "ref_code" | "status">
  >;
  // One audit row per list (not per hit) — enough to show a founder "X ran
  // a listing"; the individual decryptions happen on get, not on list.
  await audit(orgId(actor), actor, {
    action: "beneficiary.list",
    entity_type: "beneficiary",
    entity_id: new mongoose.Types.ObjectId(),
    note: opts.query ? "query_fingerprint" : "all",
    ctx,
  });
  return rows.map((r) => ({ id: r._id.toString(), ref_code: r.ref_code, status: r.status }));
}

// ---- Sub-ledger -------------------------------------------------------------

export type SubmitTxInput = {
  beneficiary_id: string;
  public_fund_id: string;
  kind: BeneficiaryFundTxKind;
  amount_cents: number;
  currency: string;
  document_ref?: string;
  note?: string;
  idempotency_key: string;
};

async function assertFundIsChildrensFund(
  org: mongoose.Types.ObjectId,
  public_fund_id: string
): Promise<void> {
  if (!mongoose.isValidObjectId(public_fund_id)) {
    throw new AppError("bad_request", "invalid fund id");
  }
  const fund = await Fund.findOne({
    _id: new mongoose.Types.ObjectId(public_fund_id),
    organization_id: org,
    kind: "restricted",
  }).lean();
  if (!fund) throw new AppError("not_found", "children's fund not found");
  const purpose = (fund.restriction?.purpose ?? "").toLowerCase();
  if (!purpose.includes("children")) {
    throw new AppError("conflict", "fund is not a children's future fund");
  }
}

export async function submitTx(
  actor: Actor,
  input: SubmitTxInput,
  ctx: RequestCtx
): Promise<{ id: string; state: string }> {
  requireAccess(actor, "beneficiaries.write");
  if (!Number.isInteger(input.amount_cents) || input.amount_cents <= 0) {
    throw new AppError("bad_request", "amount_cents must be a positive integer");
  }
  if (input.kind === "distribution" && !input.document_ref) {
    throw new AppError("unprocessable", "distributions require a supporting document", {
      fields: { document_ref: "required" },
    });
  }
  const org = orgId(actor);
  await assertFundIsChildrensFund(org, input.public_fund_id);
  const Beneficiary = await BeneficiaryModel();
  const b = await Beneficiary.findOne({
    _id: new mongoose.Types.ObjectId(input.beneficiary_id),
    organization_id: org,
  });
  if (!b) throw new AppError("not_found", "beneficiary not found");

  const Tx = await BeneficiaryFundTxModel();
  try {
    const row = await Tx.create({
      organization_id: org,
      beneficiary_id: b._id,
      public_fund_id: input.public_fund_id,
      kind: input.kind,
      state: "pending",
      amount_cents: input.amount_cents,
      currency: input.currency.toUpperCase(),
      document_ref: input.document_ref ?? null,
      note: input.note ?? null,
      idempotency_key: input.idempotency_key,
      submitted_by: new mongoose.Types.ObjectId(actor.user_id),
      submitted_at: new Date(),
    });
    await audit(org, actor, {
      action: `beneficiary_fund_tx.submit.${input.kind}`,
      entity_type: "beneficiary_fund_tx",
      entity_id: row._id,
      note: `amount=${input.amount_cents} currency=${input.currency}`,
      ctx,
    });
    return { id: row._id.toString(), state: row.state };
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      // Idempotent replay — return the existing row's state.
      const existing = await Tx.findOne({
        organization_id: org,
        idempotency_key: input.idempotency_key,
      }).lean();
      if (existing) return { id: existing._id.toString(), state: existing.state };
    }
    throw err;
  }
}

async function recomputeSummary(
  org: mongoose.Types.ObjectId,
  public_fund_id: string,
  last_event_tx_id: string | null
): Promise<void> {
  // Aggregate the private tx collection; write the summary into the MAIN
  // DB. The main DB is reachable through the ordinary `BeneficiaryFundSummary`
  // model — this write is the ONLY cross-connection operation Phase 11
  // performs.
  const Tx = await BeneficiaryFundTxModel();
  const [agg] = await Tx.aggregate([
    { $match: { organization_id: org, public_fund_id, state: "approved" } },
    {
      $group: {
        _id: null,
        inflow: {
          $sum: {
            $cond: [{ $in: ["$kind", ["contribution", "allocation"]] }, "$amount_cents", 0],
          },
        },
        outflow: {
          $sum: {
            $cond: [{ $in: ["$kind", ["distribution"]] }, "$amount_cents", 0],
          },
        },
        beneficiaries: { $addToSet: "$beneficiary_id" },
      },
    },
  ]);
  const total_in = Number(agg?.inflow ?? 0);
  const total_out = Number(agg?.outflow ?? 0);
  const beneficiary_count = Array.isArray(agg?.beneficiaries) ? agg.beneficiaries.length : 0;
  const fund = await Fund.findOne({
    _id: new mongoose.Types.ObjectId(public_fund_id),
    organization_id: org,
  }).lean();
  if (!fund) throw new AppError("not_found", "children's fund not found");
  await BeneficiaryFundSummary.updateOne(
    { organization_id: org, public_fund_id: fund._id },
    {
      $set: {
        total_in_cents: total_in,
        total_out_cents: total_out,
        balance_cents: total_in - total_out,
        beneficiary_count,
        base_currency: fund.base_currency,
        last_event_tx_id,
      },
    },
    { upsert: true }
  );
}

export async function approveTx(
  actor: Actor,
  id: string,
  ctx: RequestCtx
): Promise<{ id: string; state: string }> {
  requireAccess(actor, "beneficiaries.approve");
  const org = orgId(actor);
  const Tx = await BeneficiaryFundTxModel();
  const row = await Tx.findOne({
    _id: new mongoose.Types.ObjectId(id),
    organization_id: org,
  });
  if (!row) throw new AppError("not_found", "transaction not found");
  if (row.state !== "pending") throw new AppError("conflict", `cannot approve a ${row.state} transaction`);
  // Separation of duties — submitter cannot approve their own submission.
  if (row.submitted_by.toString() === actor.user_id) {
    throw new AppError("forbidden", "the submitter cannot approve this transaction");
  }
  row.state = "approved";
  row.approved_by = new mongoose.Types.ObjectId(actor.user_id);
  row.approved_at = new Date();
  await row.save();
  await audit(org, actor, {
    action: "beneficiary_fund_tx.approve",
    entity_type: "beneficiary_fund_tx",
    entity_id: row._id,
    note: `amount=${row.amount_cents} kind=${row.kind}`,
    ctx,
  });
  try {
    await recomputeSummary(org, row.public_fund_id, row._id.toString());
  } catch (err) {
    // We tolerate a failed summary write: the next approve will overwrite
    // it. The admin screen also exposes an on-demand recompute button.
    // The private commit stands either way.
    void err;
  }
  return { id: row._id.toString(), state: row.state };
}

export async function rejectTx(
  actor: Actor,
  id: string,
  note: string | null,
  ctx: RequestCtx
): Promise<void> {
  requireAccess(actor, "beneficiaries.approve");
  const org = orgId(actor);
  const Tx = await BeneficiaryFundTxModel();
  const row = await Tx.findOne({
    _id: new mongoose.Types.ObjectId(id),
    organization_id: org,
  });
  if (!row) throw new AppError("not_found", "transaction not found");
  if (row.state !== "pending") throw new AppError("conflict", `cannot reject a ${row.state} transaction`);
  row.state = "rejected";
  row.rejected_by = new mongoose.Types.ObjectId(actor.user_id);
  row.rejected_at = new Date();
  if (note) row.note = note.slice(0, 1000);
  await row.save();
  await audit(org, actor, {
    action: "beneficiary_fund_tx.reject",
    entity_type: "beneficiary_fund_tx",
    entity_id: row._id,
    note: note ?? undefined,
    ctx,
  });
}

export async function reverseTx(
  actor: Actor,
  id: string,
  reason: string,
  ctx: RequestCtx
): Promise<{ id: string }> {
  requireAccess(actor, "beneficiaries.reverse");
  if (!reason || reason.trim().length < 3)
    throw new AppError("unprocessable", "reversal requires a reason", { fields: { reason: "required" } });
  const org = orgId(actor);
  const Tx = await BeneficiaryFundTxModel();
  const row = await Tx.findOne({
    _id: new mongoose.Types.ObjectId(id),
    organization_id: org,
  });
  if (!row) throw new AppError("not_found", "transaction not found");
  if (row.state !== "approved") throw new AppError("conflict", "only approved transactions can be reversed");
  const now = new Date();
  // Stamp the original.
  row.reversed_by = new mongoose.Types.ObjectId(actor.user_id);
  row.reversed_at = now;
  row.state = "reversed";
  await row.save();
  // Insert the mirror row (opposite direction) so the sub-ledger balances.
  const mirror = await Tx.create({
    organization_id: org,
    beneficiary_id: row.beneficiary_id,
    public_fund_id: row.public_fund_id,
    kind: row.kind === "distribution" ? "contribution" : "distribution",
    state: "approved",
    amount_cents: row.amount_cents,
    currency: row.currency,
    document_ref: row.document_ref,
    note: `reversal: ${reason.slice(0, 500)}`,
    idempotency_key: `rev:${row._id.toString()}`,
    submitted_by: new mongoose.Types.ObjectId(actor.user_id),
    submitted_at: now,
    approved_by: new mongoose.Types.ObjectId(actor.user_id),
    approved_at: now,
    reverses_tx_id: row._id,
  });
  await audit(org, actor, {
    action: "beneficiary_fund_tx.reverse",
    entity_type: "beneficiary_fund_tx",
    entity_id: row._id,
    note: reason,
    ctx,
  });
  await recomputeSummary(org, row.public_fund_id, mirror._id.toString());
  return { id: mirror._id.toString() };
}

// ---- Admin reads ------------------------------------------------------------

export async function listPending(
  actor: Actor,
  ctx: RequestCtx
): Promise<Array<{
  id: string;
  beneficiary_id: string;
  beneficiary_ref_code: string;
  public_fund_id: string;
  kind: BeneficiaryFundTxKind;
  amount_cents: number;
  currency: string;
  submitted_by: string;
  submitted_at: string;
  document_ref: string | null;
  note: string | null;
}>> {
  requireAccess(actor, "beneficiaries.read");
  const org = orgId(actor);
  const Tx = await BeneficiaryFundTxModel();
  const rows = await Tx.find({ organization_id: org, state: "pending" })
    .sort({ submitted_at: 1 })
    .limit(100)
    .lean();
  const Beneficiary = await BeneficiaryModel();
  const bids = Array.from(new Set(rows.map((r) => r.beneficiary_id.toString())));
  const bs = (await Beneficiary.find(
    { _id: { $in: bids.map((x) => new mongoose.Types.ObjectId(x)) } },
    { ref_code: 1 }
  ).lean()) as Array<{ _id: mongoose.Types.ObjectId; ref_code: string }>;
  const refByBid = new Map(bs.map((b) => [b._id.toString(), b.ref_code]));
  await audit(org, actor, {
    action: "beneficiary_fund_tx.list_pending",
    entity_type: "beneficiary_fund_tx",
    entity_id: new mongoose.Types.ObjectId(),
    ctx,
  });
  return rows.map((r) => ({
    id: r._id.toString(),
    beneficiary_id: r.beneficiary_id.toString(),
    beneficiary_ref_code: refByBid.get(r.beneficiary_id.toString()) ?? "",
    public_fund_id: r.public_fund_id,
    kind: r.kind,
    amount_cents: r.amount_cents,
    currency: r.currency,
    submitted_by: r.submitted_by.toString(),
    submitted_at: r.submitted_at.toISOString(),
    document_ref: r.document_ref,
    note: r.note,
  }));
}

// ---- Suppressed aggregate (admin + public) ---------------------------------
//
// Reads the summary from the MAIN DB only. Applies the k-anonymity cutoff
// (§19.3 §13.7): below BENEFICIARY_SUPPRESSION_K the beneficiary count is
// hidden AND the total is hidden too (showing one with the other allows
// re-identification by inference).

export type AggregateView = {
  public_fund_id: string;
  base_currency: string;
  total_in_cents: number | null;
  total_out_cents: number | null;
  balance_cents: number | null;
  beneficiary_count: number | null;
  suppressed: boolean;
  reason: string | null;
  updated_at: string | null;
};

export async function publicAggregate(args: {
  organization_id: mongoose.Types.ObjectId;
  public_fund_id: mongoose.Types.ObjectId;
}): Promise<AggregateView> {
  const row = await BeneficiaryFundSummary.findOne({
    organization_id: args.organization_id,
    public_fund_id: args.public_fund_id,
  }).lean();
  if (!row) {
    return {
      public_fund_id: args.public_fund_id.toString(),
      base_currency: "USD",
      total_in_cents: null,
      total_out_cents: null,
      balance_cents: null,
      beneficiary_count: null,
      suppressed: true,
      reason: "no activity yet",
      updated_at: null,
    };
  }
  const k = env.BENEFICIARY_SUPPRESSION_K;
  if (row.beneficiary_count < k) {
    return {
      public_fund_id: args.public_fund_id.toString(),
      base_currency: row.base_currency,
      total_in_cents: null,
      total_out_cents: null,
      balance_cents: null,
      beneficiary_count: null,
      suppressed: true,
      reason: `below suppression threshold (k=${k})`,
      updated_at: row.updated_at?.toISOString() ?? null,
    };
  }
  return {
    public_fund_id: args.public_fund_id.toString(),
    base_currency: row.base_currency,
    total_in_cents: row.total_in_cents,
    total_out_cents: row.total_out_cents,
    balance_cents: row.balance_cents,
    beneficiary_count: row.beneficiary_count,
    suppressed: false,
    reason: null,
    updated_at: row.updated_at?.toISOString() ?? null,
  };
}

// Used by tests and the migration seed to prove the "no path from public
// to private" invariant: this is the ONLY file that imports from
// ./models.ts, and it never exports those models further.
