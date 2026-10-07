import { z } from "zod";
import { currency, nonEmpty, objectId } from "./common.js";

export const allocationBody = z.object({
  source_fund_id: objectId,
  destination_fund_id: objectId,
  amount_cents: z.number().int().positive(),
  occurred_on: z.string().date(),
  memo: z.string().max(2000).optional(),
  document_ids: z.array(objectId).max(20).optional(),
});

export const periodStatusBody = z.object({
  status: z.enum(["open", "pending_close", "closed"]),
  version: z.number().int().min(0),
});

export const periodCreateBody = z.object({
  code: z.string().regex(/^\d{4}-\d{2}$/),
});

export const reconciliationCreateBody = z.object({
  source: z.enum(["stripe", "bank", "cash_box"]),
  account_label: nonEmpty(120),
  period_code: z.string().regex(/^\d{4}-\d{2}$/),
  starts_on: z.string().date(),
  ends_on: z.string().date(),
  base_currency: currency,
  opening_balance_cents: z.number().int(),
  closing_balance_cents: z.number().int(),
  statement_lines: z
    .array(
      z.object({
        external_ref: nonEmpty(128),
        posted_on: z.string().date(),
        amount_cents: z.number().int(),
        currency: currency,
        description: z.string().max(500).optional(),
      })
    )
    .max(2000),
  notes: z.string().max(2000).optional(),
});

export const reconciliationMatchBody = z.object({
  matched_entry_ids: z.array(objectId).max(50).optional(),
  variance_note: z.string().max(500).optional().nullable(),
  version: z.number().int().min(0),
});

export const reconciliationStatusBody = z.object({
  status: z.enum(["draft", "in_review", "signed_off", "rejected"]),
  version: z.number().int().min(0),
});

export const fxRateBody = z.object({
  from: currency,
  to: currency,
  rate: z.number().positive(),
  on_date: z.string().date(),
  source: z.string().max(40).optional(),
});

export const loanCreateBody = z.object({
  direction: z.enum(["receivable", "payable"]),
  counterparty_name: nonEmpty(200),
  counterparty_identifier: z.string().max(120).optional(),
  principal_cents: z.number().int().positive(),
  base_currency: currency,
  originated_on: z.string().date(),
  due_on: z.string().date().optional(),
  interest_rate_bps: z.number().int().nonnegative().optional(),
  fund_code: nonEmpty(40),
  schedule: z
    .array(z.object({ due_on: z.string().date(), amount_cents: z.number().int().positive() }))
    .max(120)
    .optional(),
  memo: z.string().max(2000).optional(),
});

export const loanRepaymentBody = z.object({
  schedule_index: z.number().int().nonnegative(),
  paid_on: z.string().date(),
  paid_amount_cents: z.number().int().positive(),
  transaction_id: objectId.optional(),
});

export const offlineDonationBody = z.object({
  donor_name: z.string().max(160).optional(),
  donor_email: z.string().email().max(254).optional(),
  anonymous: z.boolean().optional().default(false),
  project_slug: z.string().regex(/^[a-z0-9-]{1,120}$/).optional(),
  source_currency: currency,
  gross_source_cents: z.number().int().positive(),
  fee_source_cents: z.number().int().nonnegative().optional(),
  received_on: z.string().date(),
  channel: z.enum(["cash", "bank", "mobile_money", "cheque", "other"]),
  reference: z.string().max(80).optional(),
  memo: z.string().max(500).optional(),
});

export const fundRestrictionBody = z.object({
  purpose: nonEmpty(500),
  allowed_expense_prefixes: z.array(z.string().regex(/^[a-z0-9_]{2,64}$/)).max(40).default([]),
  allowed_project_ids: z.array(objectId).max(100).default([]),
  expires_on: z.string().date().optional(),
});
