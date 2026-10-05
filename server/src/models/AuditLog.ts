import mongoose, { Schema } from "mongoose";

export type AuditLogDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  actor_id: mongoose.Types.ObjectId | null;
  actor_role: string | null;
  action: string; // e.g. "user.invite"
  entity_type: string;
  entity_id: mongoose.Types.ObjectId | string | null;
  before: unknown;
  after: unknown;
  ip: string;
  user_agent: string;
  request_id: string;
  at: Date;
};

// Append-only (§9.4). The API's database user is granted `find` + `insert`
// ONLY on this collection — migration configures that privilege.
const AuditLogSchema = new Schema<AuditLogDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    actor_id: { type: Schema.Types.ObjectId, ref: "User", default: null },
    actor_role: { type: String, default: null, maxlength: 40 },
    action: { type: String, required: true, maxlength: 100 },
    entity_type: { type: String, required: true, maxlength: 60 },
    entity_id: { type: Schema.Types.Mixed, default: null },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    ip: { type: String, default: "", maxlength: 64 },
    user_agent: { type: String, default: "", maxlength: 500 },
    request_id: { type: String, default: "", maxlength: 60 },
    at: { type: Date, required: true, default: () => new Date() },
  },
  { collection: "audit_log", versionKey: false }
);

AuditLogSchema.index({ organization_id: 1, at: -1 });
AuditLogSchema.index({ organization_id: 1, entity_type: 1, entity_id: 1 });
AuditLogSchema.index({ organization_id: 1, actor_id: 1, at: -1 });

export const AuditLog =
  mongoose.models.AuditLog ?? mongoose.model<AuditLogDoc>("AuditLog", AuditLogSchema);
