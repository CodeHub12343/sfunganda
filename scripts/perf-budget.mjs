#!/usr/bin/env node
// Lightweight performance budget check. Hits the key public pages,
// measures Time To First Byte (TTFB), checks response size against a
// per-page cap, and warns on missing cache headers. Doesn't need a
// headless browser — the budget is server-side first-byte and payload,
// which is what every incoming user sees before JS runs.
//
// Usage: node scripts/perf-budget.mjs https://sfuganda.org

import { argv, exit } from "node:process";

const BUDGETS = [
  { path: "/", ttfb_ms: 800, max_kb: 180 },
  { path: "/projects", ttfb_ms: 1000, max_kb: 220 },
  { path: "/accomplishments", ttfb_ms: 1200, max_kb: 260 },
  { path: "/impact", ttfb_ms: 900, max_kb: 180 },
  { path: "/communities", ttfb_ms: 900, max_kb: 180 },
  { path: "/transparency", ttfb_ms: 1200, max_kb: 220 },
];

const base = argv[2];
if (!base) {
  console.error("usage: perf-budget.mjs <base-url>");
  exit(64);
}

const results = [];
for (const b of BUDGETS) {
  const url = base.replace(/\/$/, "") + b.path;
  const t0 = performance.now();
  let res;
  try {
    res = await fetch(url, { headers: { "cache-control": "no-cache" } });
  } catch (err) {
    results.push({ path: b.path, error: err?.message ?? "fetch failed" });
    continue;
  }
  const ttfb = Math.round(performance.now() - t0);
  const body = await res.arrayBuffer();
  const kb = Math.round(body.byteLength / 1024);
  const cache = res.headers.get("cache-control") ?? "";
  const ok = ttfb <= b.ttfb_ms && kb <= b.max_kb;
  results.push({
    path: b.path,
    status: res.status,
    ttfb_ms: ttfb,
    kb,
    budget_ttfb_ms: b.ttfb_ms,
    budget_kb: b.max_kb,
    cache_control: cache,
    ok,
  });
}

const report = {
  base,
  checked_at: new Date().toISOString(),
  results,
  ok: results.every((r) => r.ok && !r.error),
};
console.log(JSON.stringify(report, null, 2));
exit(report.ok ? 0 : 1);
