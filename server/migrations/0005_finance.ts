import mongoose from "mongoose";
import { log } from "@/util/log.js";

export const name = "0005_finance";

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
  await ensureCollection("funds", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "code", "name", "kind", "base_currency"],
        properties: {
          kind: { enum: ["general", "project", "restricted", "endowment"] },
          base_currency: { bsonType: "string", minLength: 3, maxLength: 3 },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await ensureCollection("financial_transactions", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: [
          "organization_id",
          "kind",
          "state",
          "source_currency",
          "source_amount_cents",
          "base_currency",
          "base_amount_cents",
          "occurred_on",
          "created_by",
          "lines",
        ],
        properties: {
          kind: { enum: ["donation", "expense", "grant", "refund", "adjustment", "transfer"] },
          state: { enum: ["draft", "submitted", "approved", "posted", "reversed", "void"] },
          source_amount_cents: { bsonType: ["int", "long", "double"], minimum: 0 },
          base_amount_cents: { bsonType: ["int", "long", "double"], minimum: 0 },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  // Insert-only enforcement for ledger_entries. The 0002 migration already
  // configured the role to allow only "insert" + "find"; here we add the
  // schema validator so even a privileged client can't produce a malformed row.
  await ensureCollection("ledger_entries", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: [
          "organization_id",
          "seq",
          "transaction_id",
          "side",
          "fund_id",
          "account",
          "amount_cents",
          "base_currency",
          "posted_at",
          "prev_hash",
          "hash",
        ],
        properties: {
          side: { enum: ["debit", "credit"] },
          amount_cents: { bsonType: ["int", "long", "double"], minimum: 1 },
          prev_hash: { bsonType: "string", minLength: 1, maxLength: 64 },
          hash: { bsonType: "string", minLength: 1, maxLength: 64 },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await ensureCollection("expense_categories", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "slug", "name"],
        properties: {
          slug: { bsonType: "string", maxLength: 60 },
          name: { bsonType: "string", maxLength: 120 },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await ensureCollection("financial_documents", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "kind", "media_asset_id", "label", "uploaded_by"],
        properties: {
          kind: {
            enum: ["receipt", "invoice", "bank_statement", "grant_letter", "contract", "other"],
          },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await ensureCollection("donations", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: [
          "organization_id",
          "fund_id",
          "source_currency",
          "gross_source_cents",
          "fee_source_cents",
          "net_source_cents",
          "base_currency",
          "gross_base_cents",
          "fee_base_cents",
          "net_base_cents",
          "processor",
          "status",
          "received_at",
        ],
        properties: {
          processor: { enum: ["stripe", "manual"] },
          status: {
            enum: ["pending", "succeeded", "refunded", "partially_refunded", "disputed", "failed"],
          },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await ensureCollection("stripe_events", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: [
          "organization_id",
          "stripe_event_id",
          "type",
          "livemode",
          "received_at",
          "outcome",
          "payload",
        ],
        properties: {
          outcome: { enum: ["pending", "processed", "ignored", "error"] },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await ensureCollection("integrity_reports", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["organization_id", "ran_at", "ok", "entries_checked", "chain_tip_seq", "chain_tip_hash", "checks"],
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  const db = mongoose.connection.db!;
  await db.collection("funds").createIndexes([
    { key: { organization_id: 1, code: 1 }, name: "org_code_unique", unique: true },
    { key: { organization_id: 1, project_id: 1 }, name: "org_project", sparse: true },
  ]);
  await db.collection("financial_transactions").createIndexes([
    {
      key: { organization_id: 1, public_id: 1 },
      name: "org_public_id",
      unique: true,
      partialFilterExpression: { public_id: { $type: "string" } },
    },
    { key: { organization_id: 1, state: 1, created_at: -1 }, name: "org_state_created" },
    { key: { organization_id: 1, kind: 1, posted_at: -1 }, name: "org_kind_posted" },
    {
      key: { stripe_charge_id: 1 },
      name: "stripe_charge_unique",
      unique: true,
      partialFilterExpression: { stripe_charge_id: { $type: "string" } },
    },
    {
      key: { stripe_payment_intent_id: 1 },
      name: "stripe_pi_unique",
      unique: true,
      partialFilterExpression: { stripe_payment_intent_id: { $type: "string" } },
    },
  ]);
  await db.collection("ledger_entries").createIndexes([
    { key: { organization_id: 1, seq: 1 }, name: "org_seq_unique", unique: true },
    { key: { transaction_id: 1 }, name: "transaction" },
    { key: { organization_id: 1, account: 1, posted_at: -1 }, name: "org_account_posted" },
    { key: { organization_id: 1, fund_id: 1, posted_at: -1 }, name: "org_fund_posted" },
    { key: { project_id: 1, posted_at: -1 }, name: "project_posted", sparse: true },
    { key: { hash: 1 }, name: "hash_unique", unique: true },
  ]);
  await db.collection("expense_categories").createIndexes([
    { key: { organization_id: 1, slug: 1 }, name: "org_slug_unique", unique: true },
  ]);
  await db.collection("financial_documents").createIndexes([
    { key: { organization_id: 1, created_at: -1 }, name: "org_created" },
    { key: { transaction_ids: 1 }, name: "transactions" },
  ]);
  await db.collection("donations").createIndexes([
    {
      key: { organization_id: 1, public_id: 1 },
      name: "org_public_id",
      unique: true,
      partialFilterExpression: { public_id: { $type: "string" } },
    },
    { key: { organization_id: 1, received_at: -1 }, name: "org_received" },
    { key: { organization_id: 1, status: 1, received_at: -1 }, name: "org_status_received" },
    {
      key: { stripe_charge_id: 1 },
      name: "stripe_charge_unique",
      unique: true,
      partialFilterExpression: { stripe_charge_id: { $type: "string" } },
    },
  ]);
  await db.collection("stripe_events").createIndexes([
    { key: { organization_id: 1, stripe_event_id: 1 }, name: "org_event_unique", unique: true },
    { key: { organization_id: 1, type: 1, received_at: -1 }, name: "org_type_received" },
  ]);
  await db.collection("integrity_reports").createIndexes([
    { key: { organization_id: 1, ran_at: -1 }, name: "org_ran" },
    { key: { organization_id: 1, ok: 1, ran_at: -1 }, name: "org_ok_ran" },
  ]);
}
