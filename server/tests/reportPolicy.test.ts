import { describe, it, expect } from "vitest";
import { can, type Actor, type Action } from "../src/policy/index.js";
import type { Role } from "../src/models/RoleAssignment.js";

// Phase 9: separation of duties. The author, the finance signer, and the
// approver can never be the same person — the service layer enforces that;
// here we just check that the policy doesn't accidentally let a single role
// cover all three actions.

function actor(role: Role): Actor {
  return {
    user_id: "6508f00000000000000000aa",
    organization_id: "6508f00000000000000000bb",
    mfa_verified: true,
    assignments: [{ role, scope_type: "organization", scope_id: null }],
  };
}

const ACTIONS: Action[] = ["reports.create", "reports.sign_finance", "reports.approve", "reports.publish"];

describe("reports policy", () => {
  it("project_manager drafts but cannot finance-sign or approve", () => {
    const a = actor("project_manager");
    expect(can(a, "reports.create")).toBe(true);
    expect(can(a, "reports.edit")).toBe(true);
    expect(can(a, "reports.compile")).toBe(true);
    expect(can(a, "reports.sign_finance")).toBe(false);
    expect(can(a, "reports.approve")).toBe(false);
    expect(can(a, "reports.publish")).toBe(false);
  });

  it("finance_manager signs finance but cannot approve or publish", () => {
    const a = actor("finance_manager");
    expect(can(a, "reports.sign_finance")).toBe(true);
    expect(can(a, "reports.approve")).toBe(false);
    expect(can(a, "reports.publish")).toBe(false);
  });

  it("director approves and publishes but is not the author path", () => {
    const a = actor("director");
    expect(can(a, "reports.approve")).toBe(true);
    expect(can(a, "reports.publish")).toBe(true);
  });

  it("supporter cannot touch reports", () => {
    const a = actor("supporter");
    for (const action of ACTIONS) {
      expect(can(a, action)).toBe(false);
    }
    expect(can(a, "reports.read")).toBe(false);
  });

  it("staff without MFA cannot do any report action", () => {
    const a = { ...actor("founder"), mfa_verified: false };
    for (const action of ACTIONS) {
      expect(can(a, action)).toBe(false);
    }
  });
});
