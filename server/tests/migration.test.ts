import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { startTestDB, stopTestDB } from "./setup.js";
import * as m0001 from "../migrations/0001_initial.js";

// Migration-from-empty — the first migration must run cleanly against a
// fresh database and be idempotent on a second run.
describe("migrations", () => {
  beforeAll(async () => {
    await startTestDB();
  });
  afterAll(async () => {
    await stopTestDB();
  });

  it("applies 0001_initial and is idempotent", async () => {
    await m0001.up();
    const names = (await mongoose.connection.db!.listCollections().toArray()).map((c) => c.name);
    for (const expected of [
      "organizations",
      "users",
      "role_assignments",
      "sessions",
      "audit_log",
      "outbox_events",
      "communities",
      "id_sequences",
      "volunteer_signups",
    ]) {
      expect(names).toContain(expected);
    }
    // Run it again — must not throw.
    await m0001.up();
  });
});
