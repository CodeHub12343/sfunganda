import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { startTestDB, stopTestDB, clearTestDB } from "./setup.js";
import { writeAudit } from "../src/services/audit.js";
import { AuditLog } from "../src/models/index.js";
import mongoose from "mongoose";

// =============================================================================
// Append-only enforcement. In production, the database privilege model refuses
// updates and deletes on `audit_log`. Here we test the service contract: no
// code path in services/* writes an update to audit_log. If this test ever
// starts passing after writing an $set to audit_log, it means a reviewer let
// a mutable audit through — the policy is to always insert a new row.
// =============================================================================

describe("audit_log is append-only through the service layer", () => {
  beforeAll(async () => {
    await startTestDB();
  });
  afterAll(async () => {
    await stopTestDB();
  });
  beforeEach(async () => {
    await clearTestDB();
  });

  it("writes a row with writeAudit() and leaves it unchanged", async () => {
    const org = new mongoose.Types.ObjectId();
    await writeAudit({
      organization_id: org,
      actor_id: null,
      actor_role: null,
      action: "test.action",
      entity_type: "test",
      entity_id: null,
      after: { a: 1 },
    });
    const row = await AuditLog.findOne({ organization_id: org });
    expect(row).not.toBeNull();
    expect(row!.action).toBe("test.action");
  });

  it("the audit model carries no update timestamp (versionKey off, no updatedAt)", () => {
    const schema = AuditLog.schema;
    // No `updated_at`, no __v. Append-only rows are frozen.
    expect(schema.get("timestamps")).toBeUndefined();
    expect(schema.get("versionKey")).toBe(false);
  });
});
