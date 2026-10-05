import mongoose from "mongoose";
import { log } from "@/util/log.js";

export const name = "0006_finance_phase6";

async function ensureCollection(name: string, options: Record<string, unknown>): Promise<void> {
  const db = mongoose.connection.db!;
  const existing = (await db.listCollections({ name }).toArray()).map((c) => c.name);
  if (!existing.includes(name)) {
    await db.createCollection(name, options);
    log.info({ collection: name }, "migration.collection_created");
  } else {
    await db.command({ collMod: name, ...options });
    log.info({ collection: name }, "migration.collection_updated");
  }
}

export async function up(): Promise<void> {
  await ensureCollection("accounting_periods", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "code", "starts_on", "ends_on", "status"],
        properties: {
          status: { enum: ["open", "pending_close", "closed"] },
          code: { bsonType: "string", maxLength: 10 },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await ensureCollection("exchange_rates", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "from_currency", "to_currency", "on_date", "rate", "source", "fetched_at"],
        properties: {
          rate: { bsonType: ["double", "int"], minimum: 0 },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await ensureCollection("reconciliations", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "source", "account_label", "period_code", "starts_on", "ends_on", "base_currency", "status", "prepared_by"],
        properties: {
          source: { enum: ["stripe", "bank", "cash_box"] },
          status: { enum: ["draft", "in_review", "signed_off", "rejected"] },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await ensureCollection("loans", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "direction", "counterparty_name", "principal_cents", "base_currency", "originated_on", "fund_id", "status", "created_by"],
        properties: {
          direction: { enum: ["receivable", "payable"] },
          status: { enum: ["active", "settled", "defaulted", "cancelled"] },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  const db = mongoose.connection.db!;
  await db.collection("accounting_periods").createIndexes([
    { key: { organization_id: 1, code: 1 }, name: "org_code_unique", unique: true },
    { key: { organization_id: 1, status: 1 }, name: "org_status" },
  ]);
  await db.collection("exchange_rates").createIndexes([
    {
      key: { organization_id: 1, from_currency: 1, to_currency: 1, on_date: 1 },
      name: "org_pair_date_unique",
      unique: true,
    },
    { key: { organization_id: 1, on_date: -1 }, name: "org_date" },
  ]);
  await db.collection("reconciliations").createIndexes([
    {
      key: { organization_id: 1, period_code: 1, source: 1, account_label: 1 },
      name: "org_period_source_unique",
      unique: true,
    },
    { key: { organization_id: 1, status: 1, created_at: -1 }, name: "org_status_created" },
  ]);
  await db.collection("loans").createIndexes([
    {
      key: { organization_id: 1, public_id: 1 },
      name: "org_public_id_unique",
      unique: true,
      partialFilterExpression: { public_id: { $type: "string" } },
    },
    { key: { organization_id: 1, status: 1 }, name: "org_status" },
    {
      key: { organization_id: 1, counterparty_identifier: 1 },
      name: "org_counterparty",
      sparse: true,
    },
  ]);

  // Extend financial_transactions validator to allow secondary approval
  // fields and period_code. The 0005 validator required specific fields;
  // extending additionalProperties isn't needed since we didn't set it.
  // But we DO want to add indexes for period_code and the dual approval.
  await db.collection("financial_transactions").createIndexes([
    { key: { organization_id: 1, period_code: 1 }, name: "org_period", sparse: true },
    { key: { organization_id: 1, secondary_approved_by: 1 }, name: "org_second_approver", sparse: true },
  ]);
}
