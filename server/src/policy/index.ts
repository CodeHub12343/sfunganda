import type { Role, ScopeType } from "@/models/index.js";

// =============================================================================
// Policy module (§10.1 rule: `can()` is the ONLY place permissions are
// decided). Keep the rules explicit and testable — no reflection, no "allow
// unless denied" patterns.
//
// An actor carries their user id, organisation, and the live role_assignments
// loaded on the request (session middleware). `can` is called from services,
// NEVER only from UI (§8.2 — "RBAC: Central can() policy; enforced in
// services, never only in UI").
// =============================================================================

export type ScopeRef = {
  type: ScopeType;
  // scope_id is the organization/community/project _id as a string.
  id: string | null;
};

export type Assignment = {
  role: Role;
  scope_type: ScopeType;
  scope_id: string | null; // string form of ObjectId or null
};

export type Actor = {
  user_id: string;
  organization_id: string;
  mfa_verified: boolean;
  assignments: Assignment[];
};

// All known actions. Adding one here is a conscious decision — do not merge
// without a decision in `can()` below.
export type Action =
  // Admin shell
  | "admin.open"
  // User management
  | "users.read"
  | "users.invite"
  | "users.assign_role"
  | "users.revoke_role"
  | "users.suspend"
  | "users.reinstate"
  // Audit
  | "audit.read"
  // Communities
  | "communities.read"
  | "communities.create"
  | "communities.update"
  // Field
  | "field.open"
  // Finance
  | "finance.read"
  | "finance.write"
  // Media
  | "media.publish"
  // Self
  | "self.read"
  | "self.update";

export type Resource =
  | { kind: "none" }
  | { kind: "user"; id: string }
  | { kind: "community"; id: string }
  | { kind: "project"; id: string; community_id?: string | null }
  | { kind: "audit"; organization_id: string }
  | { kind: "finance"; organization_id: string }
  | { kind: "self"; user_id: string };

// Does the actor hold at least one of the given roles anywhere?
function hasRole(actor: Actor, ...roles: Role[]): boolean {
  return actor.assignments.some((a) => roles.includes(a.role));
}

// Does the actor hold a role scoped to the given resource (or broader)?
function hasRoleScopedTo(
  actor: Actor,
  roles: Role[],
  scope: { community_id?: string | null; project_id?: string | null }
): boolean {
  return actor.assignments.some((a) => {
    if (!roles.includes(a.role)) return false;
    if (a.scope_type === "organization") return true; // organization-wide covers everything
    if (a.scope_type === "community") return a.scope_id === scope.community_id;
    if (a.scope_type === "project") return a.scope_id === scope.project_id;
    return false;
  });
}

// Staff roles must have MFA verified before performing any admin action.
const STAFF: Role[] = [
  "founder",
  "director",
  "project_manager",
  "finance_manager",
  "media_manager",
  "field_member",
];

function requireMfaForStaff(actor: Actor): boolean {
  if (!hasRole(actor, ...STAFF)) return false;
  return !actor.mfa_verified;
}

export function can(actor: Actor, action: Action, resource: Resource = { kind: "none" }): boolean {
  // Staff who have not completed MFA cannot do admin-y things.
  if (requireMfaForStaff(actor)) {
    const mfaRequired: Action[] = [
      "admin.open",
      "users.read",
      "users.invite",
      "users.assign_role",
      "users.revoke_role",
      "users.suspend",
      "users.reinstate",
      "audit.read",
      "communities.create",
      "communities.update",
      "field.open",
      "finance.write",
    ];
    if (mfaRequired.includes(action)) return false;
  }

  switch (action) {
    case "self.read":
    case "self.update":
      return resource.kind === "self" && resource.user_id === actor.user_id;

    case "admin.open":
      return hasRole(actor, "founder", "director", "project_manager", "finance_manager", "media_manager");

    // User management — founder may do everything; a director may invite
    // field members only (enforced by services, which forward the role to
    // `users.assign_role` with the role field).
    case "users.read":
      return hasRole(actor, "founder", "director");
    case "users.invite":
      return hasRole(actor, "founder", "director");
    case "users.assign_role":
      // Directors can only grant field_member or supporter; founder can grant
      // any. The caller passes the role being granted via `resource.id` of a
      // "user" resource and the role as `audit`-friendly data; granularity is
      // enforced in the service by checking the role string against the
      // allowed set below.
      return hasRole(actor, "founder", "director");
    case "users.revoke_role":
      return hasRole(actor, "founder", "director");
    case "users.suspend":
    case "users.reinstate":
      return hasRole(actor, "founder");

    case "audit.read":
      return hasRole(actor, "founder", "director");

    case "communities.read":
      return hasRole(actor, ...STAFF);
    case "communities.create":
      return hasRole(actor, "founder", "director");
    case "communities.update":
      return hasRole(actor, "founder", "director");

    case "field.open":
      return hasRole(actor, ...STAFF);

    case "finance.read":
      if (resource.kind !== "finance") return false;
      return hasRole(actor, "founder", "director", "finance_manager");
    case "finance.write":
      if (resource.kind !== "finance") return false;
      return hasRole(actor, "founder", "finance_manager");

    case "media.publish":
      return hasRole(actor, "founder", "director", "media_manager", "project_manager");
  }
}

// Roles a director is permitted to grant (founder may grant anything).
export const DIRECTOR_GRANTABLE_ROLES: Role[] = ["field_member", "supporter"];

export function canGrantRole(actor: Actor, role: Role): boolean {
  if (hasRole(actor, "founder")) return true;
  if (hasRole(actor, "director")) return DIRECTOR_GRANTABLE_ROLES.includes(role);
  return false;
}
