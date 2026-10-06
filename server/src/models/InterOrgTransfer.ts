import mongoose, { Schema } from "mongoose";

// =============================================================================
// Phase 13 — "Pay it forward" transfer between two organisations on the
// same deployment. The two ledger_entries that actually move the money
// are posted by the finance service; this row is the application-level
// record and the idempotency anchor.
//
// Semantics:
//   • The SENDING org debits one of its unrestricted funds and credits
//     a special `transfer_out_interorg` account; the RECEIVING org
//     debits `transfer_in_interorg` and credits one of its unrestricted
//     funds. Both entries carry this row's _id as a cross-reference so
//     the hash chains on each side stay independent.
//   • Only founders may originate. The RECEIVING org must have set
//     `inter_org.receive_enabled = true` and either an empty allow-list
//     or the sender's slug in `allowed_recipient_slugs`.
//   • One-way; a reversal is a new transfer in the opposite direction.
// =============================================================================

export type InterOrgTransferState = "pending" | "posted" | "failed" | "cancelled";

export type InterOrgTransferDoc = {
  _id: mongoose.Types.ObjectId;
  from_organization_id: mongoose.Types.ObjectId;
  to_organization_id: mongoose.Types.ObjectId;
  from_fund_id: mongoose.Types.ObjectId;
  to_fund_id: mongoose.Types.ObjectId;
  amount_cents: number;
  currency: string;
  state: InterOrgTransferState;
  memo: string | null;
  idempotency_key: string;
  initiated_by: mongoose.Types.ObjectId;
  initiated_at: Date;
  posted_at: Date | null;
  // Pointers back into the respective ledgers for provenance. The
  // sending-side entry id is in `from_ledger_entry_id`, the receiving
  // side in `to_ledger_entry_id`.
  from_ledger_entry_id: mongoose.Types.ObjectId | null;
  to_ledger_entry_id: mongoose.Types.ObjectId | null;
  failure_reason: string | null;
  created_at: Date;
  updated_at: Date;
};

const Schema_ = new Schema<InterOrgTransferDoc>(
  {
    from_organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    to_organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    from_fund_id: { type: Schema.Types.ObjectId, required: true, ref: "Fund" },
    to_fund_id: { type: Schema.Types.ObjectId, required: true, ref: "Fund" },
    amount_cents: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true, maxlength: 3 },
    state: {
      type: String,
      enum: ["pending", "posted", "failed", "cancelled"],
      required: true,
      default: "pending",
    },
    memo: { type: String, default: null, maxlength: 500 },
    idempotency_key: { type: String, required: true, maxlength: 80 },
    initiated_by: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    initiated_at: { type: Date, required: true, default: () => new Date() },
    posted_at: { type: Date, default: null },
    from_ledger_entry_id: { type: Schema.Types.ObjectId, ref: "LedgerEntry", default: null },
    to_ledger_entry_id: { type: Schema.Types.ObjectId, ref: "LedgerEntry", default: null },
    failure_reason: { type: String, default: null, maxlength: 500 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, collection: "inter_org_transfers" }
);

// Idempotency on the SENDING side — two concurrent posts with the same
// key collapse to one row.
Schema_.index({ from_organization_id: 1, idempotency_key: 1 }, { unique: true });
Schema_.index({ from_organization_id: 1, state: 1, created_at: -1 });
Schema_.index({ to_organization_id: 1, state: 1, created_at: -1 });

export const InterOrgTransfer =
  mongoose.models.InterOrgTransfer ??
  mongoose.model<InterOrgTransferDoc>("InterOrgTransfer", Schema_);
