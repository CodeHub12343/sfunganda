import { z } from "zod";
import { currency, nonEmpty, objectId } from "./common.js";

export const transactionKind = z.enum([
  "donation",
  "expense",
  "grant",
  "refund",
  "adjustment",
  "transfer",
]);
export type TransactionKind = z.infer<typeof transactionKind>;

export const lineSide = z.enum(["debit", "credit"]);
export type LineSide = z.infer<typeof lineSide>;

export const transactionLineBody = z.object({
  side: lineSide,
  fund_id: objectId,
  account: z
    .string()
    .regex(/^[a-z0-9_]{2,64}$/i)
    .toLowerCase(),
  amount_cents: z.number().int().positive(),
  memo: z.string().max(500).optional(),
  project_id: objectId.optional().nullable(),
  expense_category_id: objectId.optional().nullable(),
});
export type TransactionLineBody = z.infer<typeof transactionLineBody>;

export const transactionCreateBody = z.object({
  kind: transactionKind,
  source_currency: currency,
  source_amount_cents: z.number().int().nonnegative(),
  base_currency: currency.optional(),
  base_amount_cents: z.number().int().nonnegative().optional(),
  fx_rate: z.number().positive().optional(),
  occurred_on: z.string().date(),
  memo: z.string().max(2000).optional(),
  lines: z.array(transactionLineBody).min(2),
  document_ids: z.array(objectId).max(20).optional(),
});
export type TransactionCreateBody = z.infer<typeof transactionCreateBody>;

export const transactionUpdateBody = transactionCreateBody.partial().extend({
  version: z.number().int().min(0),
});

export const transactionActionBody = z.object({
  action: z.enum(["submit", "approve", "post", "reverse", "void"]),
  version: z.number().int().min(0),
  reason: z.string().max(500).optional(),
  // Step-up proof: for approve, the client proves recent MFA by posting
  // a token the API minted via /v1/me/mfa/stepup.
  stepup_token: z.string().max(256).optional(),
});

export const fundCreateBody = z.object({
  code: nonEmpty(40),
  name: nonEmpty(160),
  kind: z.enum(["general", "project", "restricted", "endowment"]),
  project_id: objectId.optional(),
  base_currency: currency,
});

export const expenseCategoryBody = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9-]{2,60}$/)
    .toLowerCase(),
  name: nonEmpty(120),
  description: z.string().max(500).optional(),
});

export const financialDocumentBody = z.object({
  kind: z.enum(["receipt", "invoice", "bank_statement", "grant_letter", "contract", "other"]),
  media_asset_id: objectId,
  label: nonEmpty(200),
  issuer: z.string().max(160).optional(),
  issued_on: z.string().date().optional(),
  reference_no: z.string().max(80).optional(),
  transaction_ids: z.array(objectId).max(50).optional(),
});

// Donate flow (public). Body for POST /v1/donations/checkout now accepts
// an optional project designation.
export const donateCheckoutBody = z.object({
  amount: z.union([z.number(), z.string()]),
  monthly: z.boolean().optional().default(false),
  project_slug: z
    .string()
    .regex(/^[a-z0-9-]{1,120}$/)
    .optional(),
  donor_name: z.string().max(160).optional(),
  donor_email: z.string().email().max(254).optional(),
  anonymous: z.boolean().optional().default(false),
});
export type DonateCheckoutBody = z.infer<typeof donateCheckoutBody>;
