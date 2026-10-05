import mongoose, { Schema } from "mongoose";

// §9.3 role vocabulary. Keep this list in lockstep with the policy module.
export const ROLES = [
  "founder",
  "director",
  "project_manager",
  "finance_manager",
  "media_manager",
  "field_member",
  "supporter",
] as const;
export type Role = (typeof ROLES)[number];

export const SCOPE_TYPES = ["organization", "community", "project"] as const;
export type ScopeType = (typeof SCOPE_TYPES)[number];

export type RoleAssignmentDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  role: Role;
  scope_type: ScopeType;
  scope_id: mongoose.Types.ObjectId | null; // null when scope_type === 'organization'
  granted_by: mongoose.Types.ObjectId;
  granted_at: Date;
  // Not deleted; revoked. Append-only is enforced at the service layer.
  revoked_at: Date | null;
  revoked_by: mongoose.Types.ObjectId | null;
  created_at: Date;
  updated_at: Date;
};

const RoleAssignmentSchema = new Schema<RoleAssignmentDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    user_id: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    role: { type: String, enum: ROLES, required: true },
    scope_type: { type: String, enum: SCOPE_TYPES, required: true },
    scope_id: { type: Schema.Types.ObjectId, default: null },
    granted_by: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    granted_at: { type: Date, required: true, default: () => new Date() },
    revoked_at: { type: Date, default: null },
    revoked_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, collection: "role_assignments" }
);

// Unique (user, role, scope) among the live assignments. Revoked rows are
// allowed to coexist with a new live assignment for the same tuple.
RoleAssignmentSchema.index(
  { organization_id: 1, user_id: 1, role: 1, scope_type: 1, scope_id: 1 },
  { unique: true, partialFilterExpression: { revoked_at: null } }
);
RoleAssignmentSchema.index({ organization_id: 1, user_id: 1, revoked_at: 1 });

export const RoleAssignment =
  mongoose.models.RoleAssignment ??
  mongoose.model<RoleAssignmentDoc>("RoleAssignment", RoleAssignmentSchema);
