import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDB, stopTestDB } from "./setup.js";
import { buildApp } from "../src/app.js";
import request from "supertest";

// Minimal smoke suite the launch checklist runs. These are not deep
// behavioural tests — the per-feature suites cover that. They assert that
// the production-shaped app boots, the health endpoints return the
// expected shapes, and the public-facing non-auth endpoints respond.

beforeAll(async () => {
  await startTestDB();
});
afterAll(async () => {
  await stopTestDB();
});

describe("launch smoke", () => {
  const app = buildApp();

  it("/health/live returns ok JSON", async () => {
    const res = await request(app).get("/health/live").expect(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toBe("sfu-api");
  });

  it("/health/ready reports migration tip when migrations have run", async () => {
    // In test setup we don't run migrations, so this will report degraded
    // without migrations — assert the shape, not the status.
    const res = await request(app).get("/health/ready");
    expect(["ok", "degraded"]).toContain(res.body.status);
    expect(res.body).toHaveProperty("db");
    expect(res.body).toHaveProperty("migrations");
    expect(res.body).toHaveProperty("at");
  });

  it("/health/status includes outbox and integrity shape", async () => {
    const res = await request(app).get("/health/status");
    expect(res.body).toHaveProperty("outbox");
    expect(res.body.outbox).toHaveProperty("pending");
    expect(res.body.outbox).toHaveProperty("failed");
    expect(res.body).toHaveProperty("integrity");
    expect(res.body).toHaveProperty("accomplishments");
  });

  it("rejects direct API traffic without the internal proxy secret", async () => {
    const res = await request(app).get("/v1/public/impact");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("forbidden");
  });

  it("accepts proxied traffic with the internal secret header", async () => {
    const res = await request(app)
      .get("/v1/public/impact")
      .set("x-internal-secret", process.env.INTERNAL_PROXY_SECRET!);
    // Will 404 or succeed depending on whether an Organization exists;
    // either way, it must not be 403.
    expect([200, 404]).toContain(res.status);
  });
});
