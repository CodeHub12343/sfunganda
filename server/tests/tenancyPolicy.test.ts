import { describe, it, expect } from "vitest";
import { can, type Actor } from "../src/policy/index.js";
import type { Role } from "../src/models/RoleAssignment.js";

function actor(role: Role, mfa = true): Actor {
  return {
    user_id: "6508f00000000000000000aa",
    organization_id: "6508f00000000000000000bb",
    mfa_verified: mfa,
    assignments: [{ role, scope_type: "organization", scope_id: null }],
  };
}

describe("Phase 13 — organisation management policy", () => {
  it("founder may manage branding/domains and originate transfers", () => {
    const a = actor("founder");
    expect(can(a, "organization.manage")).toBe(true);
    expect(can(a, "organization.transfer_send")).toBe(true);
  });
  it("directors and finance managers may not", () => {
    for (const role of ["director", "finance_manager", "project_manager", "media_manager", "field_member", "supporter"] as const) {
      const a = actor(role);
      expect(can(a, "organization.manage")).toBe(false);
      expect(can(a, "organization.transfer_send")).toBe(false);
    }
  });
  it("MFA is required for both actions", () => {
    expect(can(actor("founder", false), "organization.manage")).toBe(false);
    expect(can(actor("founder", false), "organization.transfer_send")).toBe(false);
  });
});
