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

describe("ai policy", () => {
  it("staff may draft, supporters may not", () => {
    expect(can(actor("project_manager"), "ai.draft")).toBe(true);
    expect(can(actor("media_manager"), "ai.draft")).toBe(true);
    expect(can(actor("field_member"), "ai.draft")).toBe(true);
    expect(can(actor("founder"), "ai.draft")).toBe(true);
    expect(can(actor("supporter"), "ai.draft")).toBe(false);
  });
  it("only founders can read the AI log (§17.4)", () => {
    expect(can(actor("founder"), "ai.read_log")).toBe(true);
    expect(can(actor("director"), "ai.read_log")).toBe(false);
    expect(can(actor("project_manager"), "ai.read_log")).toBe(false);
    expect(can(actor("finance_manager"), "ai.read_log")).toBe(false);
  });
  it("MFA is required to draft", () => {
    expect(can(actor("project_manager", false), "ai.draft")).toBe(false);
    expect(can(actor("founder", false), "ai.read_log")).toBe(false);
  });
});
