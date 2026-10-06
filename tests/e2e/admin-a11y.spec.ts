import { test, expect, type Page } from "@playwright/test";

// Milestone 6 — axe-core gate.
//
// Runs axe against every admin route listed in the design doc's §12 QA matrix
// at the three breakpoints we commit to (375 / 768 / 1440). A route fails the
// gate only on "serious" or "critical" violations; "moderate" and "minor" are
// recorded as warnings so the suite does not turn into a drag on legitimate
// visual work.
//
// This spec is skipped unless `ADMIN_A11Y_SESSION_COOKIE` is in the
// environment. CI injects a cookie minted by a short-lived service account
// that has every admin role — the same account used by the smoke run.
//
// To run locally against a dev server:
//   export ADMIN_A11Y_SESSION_COOKIE='sfu_session=<value>'
//   npx playwright test tests/e2e/admin-a11y.spec.ts --project=chromium

type AxeViolation = {
  id: string;
  impact: "minor" | "moderate" | "serious" | "critical" | null;
  description: string;
  help: string;
  helpUrl: string;
  nodes: { html: string; target: string[] }[];
};

const AXE_CDN =
  "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.0/axe.min.js";

const ROUTES = [
  "/admin",
  "/admin/projects",
  "/admin/finance",
  "/admin/queue",
  "/admin/media",
  "/admin/businesses",
  "/admin/businesses/production",
  "/admin/reports",
  "/admin/users",
  "/admin/audit",
  "/admin/beneficiaries",
  "/admin/social",
  "/admin/organization",
] as const;

const VIEWPORTS = [
  { label: "mobile-375", width: 375, height: 812 },
  { label: "tablet-768", width: 768, height: 1024 },
  { label: "desktop-1440", width: 1440, height: 900 },
] as const;

const SESSION = process.env.ADMIN_A11Y_SESSION_COOKIE ?? "";

test.describe.configure({ mode: "serial" });

test.describe("Admin a11y — axe-core (Milestone 6)", () => {
  test.skip(
    !SESSION,
    "Set ADMIN_A11Y_SESSION_COOKIE to run the admin a11y gate."
  );

  test.beforeEach(async ({ context, baseURL }) => {
    if (!SESSION) return;
    const [name, value] = SESSION.split("=");
    if (!name || !value) {
      throw new Error(
        `ADMIN_A11Y_SESSION_COOKIE must look like 'name=value'; got '${SESSION}'`
      );
    }
    const url = new URL(baseURL ?? "http://localhost:3000");
    await context.addCookies([
      {
        name,
        value,
        domain: url.hostname,
        path: "/",
        httpOnly: true,
        secure: url.protocol === "https:",
        sameSite: "Lax",
      },
    ]);
  });

  for (const route of ROUTES) {
    for (const viewport of VIEWPORTS) {
      test(`${route} @ ${viewport.label}`, async ({ page }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await page.goto(route, { waitUntil: "networkidle" });
        // Mobile shell is sticky-footered; give sheets/portals a tick to mount.
        await page.waitForTimeout(250);

        const violations = await runAxe(page);
        const blocking = violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical"
        );
        const warnings = violations.filter(
          (v) => v.impact === "moderate" || v.impact === "minor"
        );

        if (warnings.length > 0) {
          console.log(
            `axe warnings on ${route} @ ${viewport.label}:`,
            summarise(warnings)
          );
        }

        expect(
          blocking,
          `axe serious/critical violations on ${route} @ ${viewport.label}:\n${summarise(blocking)}`
        ).toEqual([]);
      });
    }
  }
});

async function runAxe(page: Page): Promise<AxeViolation[]> {
  // Inject axe-core from the pinned CDN. Playwright's addScriptTag will fetch
  // it, inline it, and reject if the network/CSP blocks the load.
  await page.addScriptTag({ url: AXE_CDN });

  const result = await page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const axe = (window as any).axe;
    if (!axe) throw new Error("axe-core failed to load");
    const r = await axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"],
      },
      resultTypes: ["violations"],
    });
    return r.violations as AxeViolation[];
  });

  return result;
}

function summarise(violations: AxeViolation[]): string {
  if (violations.length === 0) return "(none)";
  return violations
    .map(
      (v) =>
        `  • [${v.impact ?? "unknown"}] ${v.id} — ${v.help} (${v.nodes.length} nodes)\n    ${v.helpUrl}`
    )
    .join("\n");
}
