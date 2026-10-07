import type { Page } from "@playwright/test";

// Shape of the throttle configuration we apply before each real-device test.
// 400 kbps down with 300 ms RTT approximates a typical rural 3G connection
// in Uganda (Leon's trial profile — §Phase 5).
export const UGANDA_3G = {
  downloadThroughputKbps: 400,
  uploadThroughputKbps: 150,
  latencyMs: 300,
};

export async function applyUgandaNetwork(page: Page): Promise<void> {
  const ctx = page.context();
  const session = await ctx.newCDPSession(page);
  await session.send("Network.enable");
  await session.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: UGANDA_3G.latencyMs,
    downloadThroughput: (UGANDA_3G.downloadThroughputKbps * 1024) / 8,
    uploadThroughput: (UGANDA_3G.uploadThroughputKbps * 1024) / 8,
  });
}
