import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Phase 5 real-device profile: Pixel 7 viewport + Africa/Kampala
    // locale + a throttled "Slow 3G"-ish network via a route-level
    // delay fixture (configured in tests/e2e/uganda-profile.ts).
    {
      name: "mobile-uganda",
      use: {
        ...devices["Pixel 7"],
        locale: "en-UG",
        timezoneId: "Africa/Kampala",
        geolocation: { latitude: 0.3476, longitude: 32.5825 },
        permissions: [],
      },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run build && npm run start",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: {
          NEXT_PUBLIC_SITE_URL: BASE_URL,
          STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY_TEST ?? "sk_test_dummy",
        },
      },
});
