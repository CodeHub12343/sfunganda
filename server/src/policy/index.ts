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
  | "media.upload"
  | "media.read_internal"
  // Projects & milestones
  | "projects.read"
  | "projects.create"
  | "projects.update"
  | "projects.archive"
  // Accomplishments
  | "accomplishments.author"
  | "accomplishments.read"
  | "accomplishments.review"
  | "accomplishments.approve"
  | "accomplishments.publish"
  | "accomplishments.archive"
  // Metrics
  | "metrics.read"
  | "metrics.write_definition"
  | "metrics.write_entry"
  // Businesses (Phase 8)
  | "businesses.read"
  | "businesses.create"
  | "businesses.update"
  | "businesses.approve"
  | "businesses.retire"
  // Business production (Phase 8)
  | "business_production.submit"
  | "business_production.approve"
  | "business_production.reverse"
  // Reports (Phase 9) — editorial / finance / overall approval are three
  // separate actions so one person can never carry a report alone.
  | "reports.read"
  | "reports.create"
  | "reports.edit"
  | "reports.compile"
  | "reports.sign_finance"
  | "reports.approve"
  | "reports.publish"
  | "reports.archive"
  | "reports.export"
  // AI assistant (Phase 10). `ai.draft` is for staff who may invoke the
  // drafting button on an accomplishment or video; `ai.read_log` is
  // founder-only (§17.4). `ai.translate_public` is a public-callable
  // action (no actor) and is gated at the route level, not here.
  | "ai.draft"
  | "ai.read_log"
  // Phase 11 — children's future fund. These actions all require
  // step-up MFA at the route layer AND presence on
  // BENEFICIARY_ACCESS_USER_IDS; the policy only answers the role
  // question. See `beneficiary/service.ts` for the full chain.
  | "beneficiaries.read"
  | "beneficiaries.write"
  | "beneficiaries.approve"
  | "beneficiaries.reverse"
  | "beneficiaries.read_aggregate_internal"
  // Phase 12 — social cross-posting.
  | "social.read"
  | "social.connect"
  | "social.retry"
  // Phase 13 — multi-organisation. `organization.manage` covers
  // branding, domains, and the inter-org settings. Pay-it-forward
  // transfers have their own action because they move money and
  // require the finance separation of duties.
  | "organization.manage"
  | "organization.transfer_send"
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
  "safeguarding_lead",
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
      "projects.create",
      "projects.update",
      "projects.archive",
      "accomplishments.review",
      "accomplishments.approve",
      "accomplishments.publish",
      "accomplishments.archive",
      "metrics.write_definition",
      "businesses.create",
      "businesses.update",
      "businesses.approve",
      "businesses.retire",
      "business_production.submit",
      "business_production.approve",
      "business_production.reverse",
      "reports.create",
      "reports.edit",
      "reports.compile",
      "reports.sign_finance",
      "reports.approve",
      "reports.publish",
      "reports.archive",
      "reports.export",
      "ai.draft",
      "ai.read_log",
      "beneficiaries.read",
      "beneficiaries.write",
      "beneficiaries.approve",
      "beneficiaries.reverse",
      "beneficiaries.read_aggregate_internal",
      "social.connect",
      "social.retry",
      "organization.manage",
      "organization.transfer_send",
    ];
    if (mfaRequired.includes(action)) return false;
  }

  switch (action) {
    case "self.read":
    case "self.update":
      return resource.kind === "self" && resource.user_id === actor.user_id;

    case "admin.open":
      return hasRole(
        actor,
        "founder",
        "director",
        "project_manager",
        "finance_manager",
        "media_manager",
        "safeguarding_lead"
      );

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

    case "media.upload":
      return hasRole(actor, ...STAFF);

    case "media.read_internal":
      return hasRole(actor, ...STAFF);

    case "projects.read":
      return hasRole(actor, ...STAFF);
    case "projects.create":
      return hasRole(actor, "founder", "director", "project_manager");
    case "projects.update":
      return hasRole(actor, "founder", "director", "project_manager");
    case "projects.archive":
      return hasRole(actor, "founder", "director");

    case "accomplishments.author":
      // Field members and project managers author; founders/directors may
      // too, though they usually review rather than author.
      return hasRole(actor, "founder", "director", "project_manager", "field_member");
    case "accomplishments.read":
      return hasRole(actor, ...STAFF);
    case "accomplishments.review":
      // Reviewers = project managers and directors; founders may step in.
      return hasRole(actor, "founder", "director", "project_manager");
    case "accomplishments.approve":
      // Approvers = directors and founders. The service enforces that the
      // approver is NOT the author (separation of duties, §15.3).
      return hasRole(actor, "founder", "director");
    case "accomplishments.publish":
      // Publishers = founders and directors. The service additionally
      // forbids the approver from being the publisher where configured.
      return hasRole(actor, "founder", "director");
    case "accomplishments.archive":
      return hasRole(actor, "founder", "director");

    case "metrics.read":
      return hasRole(actor, ...STAFF);
    case "metrics.write_definition":
      return hasRole(actor, "founder", "director", "finance_manager");
    case "metrics.write_entry":
      return hasRole(actor, "founder", "director", "project_manager", "finance_manager", "field_member");

    // Businesses — operational managers may read; project managers may draft,
    // directors/founders approve and retire. Finance manager has read because
    // sustainability is their reporting surface.
    case "businesses.read":
      return hasRole(actor, ...STAFF);
    case "businesses.create":
      return hasRole(actor, "founder", "director", "project_manager");
    case "businesses.update":
      return hasRole(actor, "founder", "director", "project_manager");
    case "businesses.approve":
      // Approve = make public. Director/founder only — separation of duties.
      return hasRole(actor, "founder", "director");
    case "businesses.retire":
      return hasRole(actor, "founder", "director");

    // Production records — field members and project managers submit; a
    // DIFFERENT actor (director/founder/finance manager) approves. The
    // service enforces that the submitter is NOT the approver.
    case "business_production.submit":
      return hasRole(actor, "founder", "director", "project_manager", "field_member", "finance_manager");
    case "business_production.approve":
      return hasRole(actor, "founder", "director", "finance_manager");
    case "business_production.reverse":
      return hasRole(actor, "founder", "director", "finance_manager");

    // Reports (Phase 9). Separation of duties:
    //   • project / media managers draft the editorial surface
    //   • finance manager signs off on the financial section
    //   • director / founder approves and publishes
    //   • once published, archive is director/founder only
    case "reports.read":
      return hasRole(actor, ...STAFF);
    case "reports.create":
    case "reports.edit":
    case "reports.compile":
      return hasRole(actor, "founder", "director", "project_manager", "media_manager");
    case "reports.sign_finance":
      return hasRole(actor, "founder", "finance_manager");
    case "reports.approve":
    case "reports.publish":
      return hasRole(actor, "founder", "director");
    case "reports.archive":
      return hasRole(actor, "founder", "director");
    case "reports.export":
      return hasRole(actor, "founder", "director", "project_manager", "media_manager", "finance_manager");

    // AI drafting — anyone who can author or review may invoke the
    // "Draft description" button (§17.1). The log of generations is
    // founder-only.
    case "ai.draft":
      return hasRole(actor, "founder", "director", "project_manager", "media_manager", "field_member");
    case "ai.read_log":
      return hasRole(actor, "founder");

    // Children's future fund (§8, §19.3). The POLICY answer is "founder
    // or safeguarding_lead", but the SERVICE additionally enforces the
    // named-individual allow-list and the step-up MFA window.
    case "beneficiaries.read":
      return hasRole(actor, "founder", "safeguarding_lead");
    case "beneficiaries.write":
      return hasRole(actor, "founder", "safeguarding_lead");
    case "beneficiaries.approve":
      // DISTRIBUTIONS require founder approval (§13.4). The lead may
      // submit for approval but may not approve.
      return hasRole(actor, "founder");
    case "beneficiaries.reverse":
      return hasRole(actor, "founder");
    case "beneficiaries.read_aggregate_internal":
      // The admin shell shows the SAME suppressed aggregate as the
      // public page — any staff with admin access may see it.
      return hasRole(actor, "founder", "director", "finance_manager", "safeguarding_lead");

    // Social cross-posting (§14.7). Media managers and founders/directors
    // may connect accounts and trigger retries; project managers can read
    // status for the videos they own.
    case "social.read":
      return hasRole(actor, "founder", "director", "media_manager", "project_manager");
    case "social.connect":
      return hasRole(actor, "founder", "director", "media_manager");
    case "social.retry":
      return hasRole(actor, "founder", "director", "media_manager");

    // Phase 13 — org settings and inter-org money moves. Only the
    // founder can manage branding/domains and originate transfers.
    // A finance manager cannot send another organisation money —
    // this is a change in the ownership of funds.
    case "organization.manage":
      return hasRole(actor, "founder");
    case "organization.transfer_send":
      return hasRole(actor, "founder");
  }
}

// Roles a director is permitted to grant (founder may grant anything).
export const DIRECTOR_GRANTABLE_ROLES: Role[] = ["field_member", "supporter"];

export function canGrantRole(actor: Actor, role: Role): boolean {
  if (hasRole(actor, "founder")) return true;
  if (hasRole(actor, "director")) return DIRECTOR_GRANTABLE_ROLES.includes(role);
  return false;
}
