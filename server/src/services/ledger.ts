import { createHash } from "node:crypto";
import mongoose from "mongoose";
import {
  Fund,
  IdSequence,
  LedgerEntry,
  type FinancialTransactionDoc,
  type LedgerEntryDoc,
  type TransactionLine,
} from "@/models/index.js";
import { AppError } from "@/util/errors.js";
import { env } from "@/config/env.js";

// ============================================================================
// Ledger primitives. Entries are insert-only (role-enforced in migration
// 0002, schema-enforced in 0005) and form a SHA-256 hash chain anchored at
// LEDGER_HASH_SEED. Each row:
//   hash = sha256(seed || prev_hash || canonical({seq, txId, side, fund_id,
//          account, amount_cents, base_currency, project_id, expense_cat_id,
//          posted_at_ms}))
// Any mutation of a historical row breaks every subsequent hash.
// ============================================================================

function seedHash(organization_id: string): string {
  return createHash("sha256").update(env.LEDGER_HASH_SEED + ":" + organization_id).digest("hex");
}

function canonicalRow(row: {
  seq: number;
  transaction_id: string;
  side: "debit" | "credit";
  fund_id: string;
  account: string;
  amount_cents: number;
  base_currency: string;
  project_id: string | null;
  expense_category_id: string | null;
  posted_at: number;
}): string {
  // Stable key order; no whitespace. Values stringified predictably.
  return JSON.stringify({
    seq: row.seq,
    tx: row.transaction_id,
    side: row.side,
    fund: row.fund_id,
    account: row.account,
    amount: row.amount_cents,
    currency: row.base_currency,
    project: row.project_id ?? null,
    category: row.expense_category_id ?? null,
    at: row.posted_at,
  });
}

export function computeHash(prev_hash: string, row: Parameters<typeof canonicalRow>[0], seed: string): string {
  return createHash("sha256")
    .update(seed)
    .update("\x1e")
    .update(prev_hash)
    .update("\x1e")
    .update(canonicalRow(row))
    .digest("hex");
}

// Each transaction must balance (sum of debits == sum of credits). Any
// transaction NOT satisfying this is rejected before any ledger write.
export function assertBalanced(lines: TransactionLine[]): void {
  if (lines.length < 2) {
    throw new AppError("unprocessable", "a transaction needs at least two lines");
  }
  let debit = 0;
  let credit = 0;
  for (const l of lines) {
    if (l.amount_cents <= 0) {
      throw new AppError("unprocessable", "line amounts must be positive integers");
    }
    if (l.side === "debit") debit += l.amount_cents;
    else credit += l.amount_cents;
  }
  if (debit !== credit) {
    throw new AppError("unprocessable", "transaction is unbalanced", {
      fields: { lines: `debits ${debit} ≠ credits ${credit}` },
    });
  }
}

export type PostResult = {
  entries: LedgerEntryDoc[];
  tip_hash: string;
  seq_start: number;
  seq_end: number;
};

// Post a balanced transaction's lines into the ledger and update fund
// balances. MUST be called inside a Mongo transaction. The seed is scoped
// to the organization so cross-org tampering can't swap chains.
export async function postToLedger(
  tx: FinancialTransactionDoc,
  session: mongoose.ClientSession
): Promise<PostResult> {
  assertBalanced(tx.lines);
  const orgId = tx.organization_id;
  const seed = seedHash(orgId.toString());

  // Allocate contiguous sequence numbers up front.
  const seqDoc = await IdSequence.findOneAndUpdate(
    { organization_id: orgId, kind: "ledger", year: 0 },
    { $inc: { next_value: tx.lines.length }, $setOnInsert: { organization_id: orgId, kind: "ledger", year: 0 } },
    { upsert: true, new: true, session }
  );
  const nextAfter = seqDoc.next_value; // next_value already incremented
  const seqStart = nextAfter - tx.lines.length;

  // Load the current tip hash (from the latest entry) once.
  const tip = await LedgerEntry.findOne({ organization_id: orgId })
    .sort({ seq: -1 })
    .session(session)
    .lean<LedgerEntryDoc>();
  let prev_hash = tip?.hash ?? seed;

  const postedAt = new Date();
  const docs: LedgerEntryDoc[] = [];
  for (let i = 0; i < tx.lines.length; i++) {
    const line = tx.lines[i]!;
    const seq = seqStart + i + 1;
    const rowForHash = {
      seq,
      transaction_id: tx._id.toString(),
      side: line.side,
      fund_id: line.fund_id.toString(),
      account: line.account,
      amount_cents: line.amount_cents,
      base_currency: tx.base_currency,
      project_id: line.project_id ? line.project_id.toString() : null,
      expense_category_id: line.expense_category_id ? line.expense_category_id.toString() : null,
      posted_at: postedAt.getTime(),
    };
    const hash = computeHash(prev_hash, rowForHash, seed);
    const [doc] = await LedgerEntry.create(
      [
        {
          organization_id: orgId,
          seq,
          transaction_id: tx._id,
          transaction_public_id: tx.public_id,
          side: line.side,
          fund_id: line.fund_id,
          account: line.account,
          amount_cents: line.amount_cents,
          base_currency: tx.base_currency,
          memo: line.memo ?? tx.memo ?? null,
          project_id: line.project_id,
          expense_category_id: line.expense_category_id,
          posted_at: postedAt,
          prev_hash,
          hash,
        },
      ],
      { session }
    );
    if (!doc) throw new AppError("internal_error", "ledger write returned no doc");
    docs.push(doc.toObject() as LedgerEntryDoc);
    prev_hash = hash;
  }

  // Update fund balances in the same txn. "cash" and "stripe_clearing" are
  // asset accounts (debit increases, credit decreases); revenue/expense
  // sides work in reverse for balance_cents semantics (we treat
  // balance_cents as "money currently held in the fund"). To keep things
  // simple and correct across kinds, we classify by account prefix:
  //   - cash / stripe_clearing / bank_* : asset accounts
  //   - revenue_* / contribution_* : revenue, credits raise fund inflow
  //   - expense_* / fee_* : expense, debits raise fund outflow
  for (const line of tx.lines) {
    const sign = balanceDelta(line);
    if (sign.balance === 0 && sign.in === 0 && sign.out === 0) continue;
    await Fund.updateOne(
      { _id: line.fund_id, organization_id: orgId },
      {
        $inc: {
          balance_cents: sign.balance * line.amount_cents,
          total_in_cents: sign.in * line.amount_cents,
          total_out_cents: sign.out * line.amount_cents,
        },
      },
      { session }
    );
  }

  return {
    entries: docs,
    tip_hash: prev_hash,
    seq_start: seqStart + 1,
    seq_end: seqStart + tx.lines.length,
  };
}

function balanceDelta(line: TransactionLine): { balance: number; in: number; out: number } {
  const a = line.account;
  if (a === "cash" || a.startsWith("bank_") || a === "stripe_clearing") {
    // Asset: debit raises, credit lowers.
    const d = line.side === "debit" ? 1 : -1;
    return { balance: d, in: d > 0 ? 1 : 0, out: d < 0 ? 1 : 0 };
  }
  if (a.startsWith("revenue_") || a.startsWith("contribution_") || a === "donations_received") {
    // Revenue: credit raises inflow. We don't change balance_cents here —
    // the matched asset side already did it. Only inflow counter moves.
    return { balance: 0, in: line.side === "credit" ? 1 : -1, out: 0 };
  }
  if (a.startsWith("expense_") || a.startsWith("fee_") || a === "payment_fees") {
    return { balance: 0, in: 0, out: line.side === "debit" ? 1 : -1 };
  }
  return { balance: 0, in: 0, out: 0 };
}

// Build the counter-lines for a reversal: same accounts, opposite sides.
export function reversalLines(lines: TransactionLine[]): TransactionLine[] {
  return lines.map((l) => ({ ...l, side: l.side === "debit" ? "credit" : "debit" }));
}

// Verify the hash chain for an organization. Returns the seq where it first
// breaks, or null if intact.
export async function verifyChain(
  organization_id: mongoose.Types.ObjectId
): Promise<{ ok: boolean; first_bad_seq: number | null; last_seq: number; tip_hash: string }> {
  const seed = seedHash(organization_id.toString());
  const cursor = LedgerEntry.find({ organization_id }).sort({ seq: 1 }).lean().cursor();
  let prev_hash = seed;
  let last_seq = 0;
  for await (const row of cursor) {
    const e = row as LedgerEntryDoc;
    const rowForHash = {
      seq: e.seq,
      transaction_id: e.transaction_id.toString(),
      side: e.side,
      fund_id: e.fund_id.toString(),
      account: e.account,
      amount_cents: e.amount_cents,
      base_currency: e.base_currency,
      project_id: e.project_id ? e.project_id.toString() : null,
      expense_category_id: e.expense_category_id ? e.expense_category_id.toString() : null,
      posted_at: e.posted_at.getTime(),
    };
    const expected = computeHash(prev_hash, rowForHash, seed);
    if (e.prev_hash !== prev_hash || e.hash !== expected) {
      return { ok: false, first_bad_seq: e.seq, last_seq, tip_hash: prev_hash };
    }
    prev_hash = e.hash;
    last_seq = e.seq;
  }
  return { ok: true, first_bad_seq: null, last_seq, tip_hash: prev_hash };
}
