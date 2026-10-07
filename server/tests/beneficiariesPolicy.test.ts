import { describe, it, expect } from "vitest";
import { can, type Actor } from "../src/policy/index.js";
import type { Role } from "../src/models/RoleAssignment.js";

// Phase 11 — role matrix for beneficiary actions. Attempts by every role
// outside {founder, safeguarding_lead} must be refused (C5 + §19.3).

function actor(role: Role, mfa = true): Actor {
  return {
    user_id: "6508f00000000000000000aa",
    organization_id: "6508f00000000000000000bb",
    mfa_verified: mfa,
    assignments: [{ role, scope_type: "organization", scope_id: null }],
  };
}

describe("beneficiary policy", () => {
  const privateActions = ["beneficiaries.read", "beneficiaries.write", "beneficiaries.approve", "beneficiaries.reverse"] as const;
  const everyoneElse: Role[] = [
    "director",
    "project_manager",
    "finance_manager",
    "media_manager",
    "field_member",
    "supporter",
  ];

  it("founder may perform every beneficiary action", () => {
    const a = actor("founder");
    for (const action of privateActions) expect(can(a, action)).toBe(true);
  });

  it("safeguarding_lead may read and write but cannot approve or reverse", () => {
    const a = actor("safeguarding_lead");
    expect(can(a, "beneficiaries.read")).toBe(true);
    expect(can(a, "beneficiaries.write")).toBe(true);
    expect(can(a, "beneficiaries.approve")).toBe(false);
    expect(can(a, "beneficiaries.reverse")).toBe(false);
  });

  it("every other role is denied all four private actions", () => {
    for (const role of everyoneElse) {
      const a = actor(role);
      for (const action of privateActions) {
        expect(can(a, action), `${role} should not have ${action}`).toBe(false);
      }
    }
  });

  it("no beneficiary action is permitted without MFA", () => {
    for (const action of privateActions) {
      expect(can(actor("founder", false), action)).toBe(false);
    }
  });

  it("the admin aggregate (NOT the private read) is available to finance/director too", () => {
    expect(can(actor("director"), "beneficiaries.read_aggregate_internal")).toBe(true);
    expect(can(actor("finance_manager"), "beneficiaries.read_aggregate_internal")).toBe(true);
    expect(can(actor("project_manager"), "beneficiaries.read_aggregate_internal")).toBe(false);
    expect(can(actor("supporter"), "beneficiaries.read_aggregate_internal")).toBe(false);
  });
});
