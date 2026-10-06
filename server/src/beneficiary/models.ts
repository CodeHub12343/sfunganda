import mongoose, { Schema } from "mongoose";
import { getPrivateConnection } from "./db.js";
import type { EncryptedField } from "./crypto.js";

// =============================================================================
// Phase 11 models. These schemas are compiled onto the PRIVATE connection
// only — none of them appear in `src/models/index.js`, so nothing else can
// `import` them. The getters return the compiled Model lazily so the
// connection is only opened when a service call reaches here.
// =============================================================================

export type BeneficiaryStatus = "active" | "left" | "aged_out";

export type BeneficiaryPrivateRecordDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  // Public-safe reference. Random, non-sequential, never a child's initials
  // or birth-year. Used by the sub-ledger instead of a name.
  ref_code: string;
  // Encrypted PII (field-level, AES-256-GCM; see crypto.ts).
  name_ct: EncryptedField;
  dob_ct: EncryptedField | null;
  guardian_ct: EncryptedField | null;
  // Non-reversible fingerprint of the name — enables lookup without
  // decrypting every row.
  name_fingerprint: string;
  status: BeneficiaryStatus;
  notes_ct: EncryptedField | null;
  created_by: mongoose.Types.ObjectId;
  updated_by: mongoose.Types.ObjectId | null;
  created_at: Date;
  updated_at: Date;
};

const EncryptedFieldSchema = new Schema<EncryptedField>(
  {
    v: { type: Number, enum: [1], required: true },
    kid: { type: String, required: true, maxlength: 32 },
    iv: { type: String, required: true, maxlength: 64 },
    ct: { type: String, required: true, maxlength: 20_000 },
    tag: { type: String, required: true, maxlength: 64 },
  },
  { _id: false }
);

const BeneficiaryPrivateRecordSchema = new Schema<BeneficiaryPrivateRecordDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true },
    ref_code: { type: String, required: true, maxlength: 20 },
    name_ct: { type: EncryptedFieldSchema, required: true },
    dob_ct: { type: EncryptedFieldSchema, default: null },
    guardian_ct: { type: EncryptedFieldSchema, default: null },
    name_fingerprint: { type: String, required: true, maxlength: 64 },
    status: { type: String, enum: ["active", "left", "aged_out"], required: true, default: "active" },
    notes_ct: { type: EncryptedFieldSchema, default: null },
    created_by: { type: Schema.Types.ObjectId, required: true },
    updated_by: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, collection: "beneficiary_private_records" }
);

BeneficiaryPrivateRecordSchema.index(
  { organization_id: 1, ref_code: 1 },
  { unique: true }
);
BeneficiaryPrivateRecordSchema.index({ organization_id: 1, name_fingerprint: 1 });
BeneficiaryPrivateRecordSchema.index({ organization_id: 1, status: 1 });

// --- Sub-ledger ---------------------------------------------------------------
//
// The "children's future fund" is modelled as a public fund (lives in the
// main DB, enters normal ledger_entries). The PER-CHILD split is only here
// in the private DB. Public code never joins these two: the only bridge is
// the periodic summary projection the service writes to the public DB.
//

export type BeneficiaryFundTxKind = "contribution" | "allocation" | "distribution" | "adjustment";
export type BeneficiaryFundTxState = "pending" | "approved" | "rejected" | "reversed";

export type BeneficiaryFundTransactionDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  beneficiary_id: mongoose.Types.ObjectId;
  // String form of the public fund _id — not an ObjectId ref, because the
  // referenced collection lives in another database. The service validates
  // the fund exists before accepting the write.
  public_fund_id: string;
  kind: BeneficiaryFundTxKind;
  state: BeneficiaryFundTxState;
  amount_cents: number;
  currency: string;
  // Opaque identifier for a supporting document in the main DB. The private
  // module never joins on this; the public admin UI resolves it to a
  // document when it renders the approval queue.
  document_ref: string | null;
  note: string | null;
  idempotency_key: string;
  submitted_by: mongoose.Types.ObjectId;
  submitted_at: Date;
  approved_by: mongoose.Types.ObjectId | null;
  approved_at: Date | null;
  rejected_by: mongoose.Types.ObjectId | null;
  rejected_at: Date | null;
  reversed_by: mongoose.Types.ObjectId | null;
  reversed_at: Date | null;
  // If a reversal was issued, this points at the original row (and the
  // original row's `reversed_at` is stamped). Both rows stay in place —
  // we never delete financial history.
  reverses_tx_id: mongoose.Types.ObjectId | null;
  created_at: Date;
  updated_at: Date;
};

const BeneficiaryFundTxSchema = new Schema<BeneficiaryFundTransactionDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true },
    beneficiary_id: { type: Schema.Types.ObjectId, required: true },
    public_fund_id: { type: String, required: true, maxlength: 32 },
    kind: {
      type: String,
      enum: ["contribution", "allocation", "distribution", "adjustment"],
      required: true,
    },
    state: {
      type: String,
      enum: ["pending", "approved", "rejected", "reversed"],
      required: true,
      default: "pending",
    },
    amount_cents: { type: Number, required: true },
    currency: { type: String, required: true, maxlength: 3 },
    document_ref: { type: String, default: null, maxlength: 60 },
    note: { type: String, default: null, maxlength: 1000 },
    idempotency_key: { type: String, required: true, maxlength: 60 },
    submitted_by: { type: Schema.Types.ObjectId, required: true },
    submitted_at: { type: Date, required: true },
    approved_by: { type: Schema.Types.ObjectId, default: null },
    approved_at: { type: Date, default: null },
    rejected_by: { type: Schema.Types.ObjectId, default: null },
    rejected_at: { type: Date, default: null },
    reversed_by: { type: Schema.Types.ObjectId, default: null },
    reversed_at: { type: Date, default: null },
    reverses_tx_id: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, collection: "beneficiary_fund_transactions" }
);

BeneficiaryFundTxSchema.index(
  { organization_id: 1, idempotency_key: 1 },
  { unique: true }
);
BeneficiaryFundTxSchema.index({ organization_id: 1, state: 1, created_at: -1 });
BeneficiaryFundTxSchema.index({ organization_id: 1, beneficiary_id: 1, created_at: -1 });
BeneficiaryFundTxSchema.index({ organization_id: 1, public_fund_id: 1, state: 1 });

// --- Audit log (private copy, so beneficiary names never land in the
// main-database audit_log where founder-less roles can list) --------------

export type BeneficiaryAuditDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  actor_id: mongoose.Types.ObjectId;
  action: string;
  // Opaque entity reference; may be a beneficiary_id or a transaction_id.
  entity_type: "beneficiary" | "beneficiary_fund_tx";
  entity_id: mongoose.Types.ObjectId;
  // We log the DIFF for writes and a redacted descriptor for reads. The
  // field list that was decrypted is captured so a founder reviewing can
  // see "who viewed what", not "what the viewer saw".
  fields_viewed: string[];
  note: string | null;
  ip: string;
  user_agent: string;
  request_id: string;
  created_at: Date;
};

const BeneficiaryAuditSchema = new Schema<BeneficiaryAuditDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true },
    actor_id: { type: Schema.Types.ObjectId, required: true },
    action: { type: String, required: true, maxlength: 80 },
    entity_type: { type: String, enum: ["beneficiary", "beneficiary_fund_tx"], required: true },
    entity_id: { type: Schema.Types.ObjectId, required: true },
    fields_viewed: { type: [String], default: [] },
    note: { type: String, default: null, maxlength: 500 },
    ip: { type: String, default: "", maxlength: 64 },
    user_agent: { type: String, default: "", maxlength: 500 },
    request_id: { type: String, default: "", maxlength: 64 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false }, collection: "beneficiary_audit_log" }
);

BeneficiaryAuditSchema.index({ organization_id: 1, created_at: -1 });
BeneficiaryAuditSchema.index({ organization_id: 1, entity_id: 1, created_at: -1 });
BeneficiaryAuditSchema.index({ organization_id: 1, actor_id: 1, created_at: -1 });

// Lazy accessors — the connection is opened on first use.
export async function BeneficiaryModel() {
  const conn = await getPrivateConnection();
  return (
    conn.models.BeneficiaryPrivateRecord ??
    conn.model<BeneficiaryPrivateRecordDoc>(
      "BeneficiaryPrivateRecord",
      BeneficiaryPrivateRecordSchema
    )
  );
}

export async function BeneficiaryFundTxModel() {
  const conn = await getPrivateConnection();
  return (
    conn.models.BeneficiaryFundTx ??
    conn.model<BeneficiaryFundTransactionDoc>(
      "BeneficiaryFundTx",
      BeneficiaryFundTxSchema
    )
  );
}

export async function BeneficiaryAuditModel() {
  const conn = await getPrivateConnection();
  return (
    conn.models.BeneficiaryAudit ??
    conn.model<BeneficiaryAuditDoc>("BeneficiaryAudit", BeneficiaryAuditSchema)
  );
}
