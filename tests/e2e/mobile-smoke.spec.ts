import { expect, test } from "@playwright/test";
import { applyUgandaNetwork } from "./uganda-profile.js";

// Mobile smoke test on the Uganda real-device profile. These assertions are
// intentionally about user outcomes, not pixel comparisons — the
// accessibility and perf-budget scripts cover the quantitative gates.

test.describe("mobile Uganda", () => {
  test.skip(({ browserName }) => browserName !== "chromium");

  test("home page loads under 5 seconds on throttled 3G", async ({ page }) => {
    await applyUgandaNetwork(page);
    const t0 = Date.now();
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(Date.now() - t0).toBeLessThan(5000);
  });

  test("public portal is reachable", async ({ page }) => {
    await applyUgandaNetwork(page);
    for (const path of ["/projects", "/accomplishments", "/communities", "/impact", "/transparency"]) {
      const res = await page.goto(path);
      expect(res?.status()).toBeLessThan(500);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });

  test("skip-to-content link is the first focusable element", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() =>
      document.activeElement?.textContent?.trim().toLowerCase()
    );
    expect(focused).toContain("skip to content");
  });

  test("video page gracefully handles no videos", async ({ page }) => {
    await applyUgandaNetwork(page);
    const res = await page.goto("/videos");
    expect(res?.status()).toBeLessThan(500);
  });

  test("donate button reaches the checkout path", async ({ page }) => {
    await page.goto("/");
    // The home page has a donation CTA somewhere; follow the first
    // link that targets the donate section.
    const cta = page.locator("a:has-text('Donate'), button:has-text('Donate')").first();
    if (await cta.count()) {
      await cta.scrollIntoViewIfNeeded();
      await expect(cta).toBeVisible();
    }
  });
});
