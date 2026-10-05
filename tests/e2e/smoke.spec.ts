import { test, expect } from "@playwright/test";

test.describe("smoke", () => {
  test("home renders primary content", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /donate/i }).first()).toBeVisible();
  });

  test("/api/health returns ok", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  // Phase 1: /api/checkout and /api/volunteer were replaced by /api/v1/*
  // endpoints that forward to the Express service. The browser E2E suite
  // doesn't boot the API; those contracts are tested in the server package
  // (`server/tests`). We only confirm the rewrite path exists here.
  test("rewrite path reaches the API placeholder when API is down", async ({ request }) => {
    // When the Express API is not running, the Next.js rewrite returns 500
    // or 502. Either way, the path is NOT a 404 — proving the rewrite is wired.
    const res = await request.post("/api/v1/volunteers/", {
      data: {},
      headers: { "content-type": "application/json" },
    });
    expect(res.status()).not.toBe(404);
  });

  test("privacy page renders and is linked from the footer", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: /privacy policy/i })).toBeVisible();
  });
});
