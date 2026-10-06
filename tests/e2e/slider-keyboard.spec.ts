import { test, expect } from "@playwright/test";

// Phase 8: "slider keyboard operation". The before/after slider on /gallery
// is a native role=slider, so a keyboard-only user can move it with the
// arrow keys. If this test fails, the slider has regressed to mouse-only
// and the page is no longer WCAG-compliant.

test.describe("gallery before/after slider", () => {
  test("is operable from the keyboard alone", async ({ page }) => {
    await page.goto("/gallery");
    const slider = page.getByRole("slider").first();
    await expect(slider).toBeVisible();

    const start = await slider.getAttribute("aria-valuenow");
    await slider.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    const afterRight = await slider.getAttribute("aria-valuenow");
    expect(Number(afterRight)).toBeGreaterThan(Number(start));

    await page.keyboard.press("Home");
    expect(await slider.getAttribute("aria-valuenow")).toBe("0");

    await page.keyboard.press("End");
    expect(await slider.getAttribute("aria-valuenow")).toBe("100");
  });
});
