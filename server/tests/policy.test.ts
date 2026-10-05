import { describe, it, expect } from "vitest";
import { can, canGrantRole, type Actor, type Action } from "../src/policy/index.js";
import type { Role } from "../src/models/RoleAssignment.js";

const ORG = "6508f0000000000000000001";

function actor(role: Role | null, mfa = true): Actor {
  return {
    user_id: "6508f0000000000000000099",
    organization_id: ORG,
    mfa_verified: mfa,
    assignments: role
      ? [{ role, scope_type: "organization", scope_id: null }]
      : [],
  };
}

// =============================================================================
// Authz matrix generator. For each role × a chosen action, assert the exact
// expected answer. The matrix is maintained here, not generated at runtime,
// so a policy drift triggers a test diff (§Testing: "authz matrix generator").
// =============================================================================

type Row = { action: Action; role: Role | "anon"; expected: boolean };

const MATRIX: Row[] = [
  // admin.open
  { action: "admin.open", role: "founder", expected: true },
  { action: "admin.open", role: "director", expected: true },
  { action: "admin.open", role: "project_manager", expected: true },
  { action: "admin.open", role: "finance_manager", expected: true },
  { action: "admin.open", role: "media_manager", expected: true },
  { action: "admin.open", role: "field_member", expected: false },
  { action: "admin.open", role: "supporter", expected: false },
  { action: "admin.open", role: "anon", expected: false },

  // users.invite
  { action: "users.invite", role: "founder", expected: true },
  { action: "users.invite", role: "director", expected: true },
  { action: "users.invite", role: "project_manager", expected: false },
  { action: "users.invite", role: "finance_manager", expected: false },
  { action: "users.invite", role: "media_manager", expected: false },
  { action: "users.invite", role: "field_member", expected: false },
  { action: "users.invite", role: "supporter", expected: false },

  // users.suspend — founder only
  { action: "users.suspend", role: "founder", expected: true },
  { action: "users.suspend", role: "director", expected: false },

  // audit.read
  { action: "audit.read", role: "founder", expected: true },
  { action: "audit.read", role: "director", expected: true },
  { action: "audit.read", role: "field_member", expected: false },
];

describe("policy — authz matrix", () => {
  for (const row of MATRIX) {
    it(`${row.role} can${row.expected ? "" : "not"} ${row.action}`, () => {
      const a = row.role === "anon" ? actor(null) : actor(row.role);
      expect(can(a, row.action)).toBe(row.expected);
    });
  }
});

describe("policy — staff without MFA cannot do admin actions", () => {
  for (const action of [
    "admin.open",
    "users.read",
    "users.invite",
    "audit.read",
  ] as Action[]) {
    it(`founder without MFA cannot ${action}`, () => {
      expect(can(actor("founder", false), action)).toBe(false);
    });
  }
});

describe("policy — directors can only grant field_member and supporter", () => {
  it("director grants field_member — ok", () => {
    expect(canGrantRole(actor("director"), "field_member")).toBe(true);
    expect(canGrantRole(actor("director"), "supporter")).toBe(true);
  });
  it("director cannot grant higher roles", () => {
    expect(canGrantRole(actor("director"), "director")).toBe(false);
    expect(canGrantRole(actor("director"), "founder")).toBe(false);
    expect(canGrantRole(actor("director"), "finance_manager")).toBe(false);
  });
  it("founder can grant anything", () => {
    expect(canGrantRole(actor("founder"), "founder")).toBe(true);
  });
});
