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

describe("social policy", () => {
  it("media_manager, director and founder may connect and retry", () => {
    for (const role of ["founder", "director", "media_manager"] as const) {
      expect(can(actor(role), "social.connect")).toBe(true);
      expect(can(actor(role), "social.retry")).toBe(true);
    }
  });
  it("project_manager may read but not connect/retry", () => {
    const a = actor("project_manager");
    expect(can(a, "social.read")).toBe(true);
    expect(can(a, "social.connect")).toBe(false);
    expect(can(a, "social.retry")).toBe(false);
  });
  it("finance_manager and field_member and supporter are refused", () => {
    for (const role of ["finance_manager", "field_member", "supporter"] as const) {
      const a = actor(role);
      expect(can(a, "social.read")).toBe(false);
      expect(can(a, "social.connect")).toBe(false);
      expect(can(a, "social.retry")).toBe(false);
    }
  });
  it("MFA is required to connect / retry", () => {
    expect(can(actor("founder", false), "social.connect")).toBe(false);
    expect(can(actor("founder", false), "social.retry")).toBe(false);
  });
});
