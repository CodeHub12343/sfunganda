#!/usr/bin/env node
// Security headers scanner. Hits a target URL and reports missing / weak
// response headers. Exit non-zero when a required header is missing so CI
// can fail the deploy.
//
// Usage: node scripts/headers-scan.mjs https://sfuganda.org
//
// Mirrors the baseline from next.config.mjs so a drift between the config
// and what the edge actually serves is caught at launch.

import { argv, exit } from "node:process";

const REQUIRED = {
  "x-content-type-options": (v) => v === "nosniff",
  "x-frame-options": (v) => v === "DENY" || v === "SAMEORIGIN",
  "referrer-policy": (v) => /strict-origin/.test(v ?? ""),
  "strict-transport-security": (v) => /max-age=\d+/.test(v ?? ""),
  "content-security-policy": (v) =>
    v != null &&
    /frame-ancestors\s+'none'/i.test(v) &&
    /object-src\s+'none'/i.test(v) &&
    /base-uri/i.test(v),
  "permissions-policy": (v) => v != null,
};

const url = argv[2];
if (!url) {
  console.error("usage: headers-scan.mjs <url>");
  exit(64);
}

try {
  const res = await fetch(url, { redirect: "manual" });
  const headers = Object.fromEntries([...res.headers.entries()].map(([k, v]) => [k.toLowerCase(), v]));
  const missing = [];
  const warnings = [];
  for (const [h, check] of Object.entries(REQUIRED)) {
    const v = headers[h];
    if (!v) {
      missing.push(h);
      continue;
    }
    if (!check(v)) warnings.push({ header: h, value: v });
  }
  const serverLeaks = ["server", "x-powered-by"].filter((h) => headers[h]);
  const report = {
    url,
    status: res.status,
    missing,
    weak: warnings,
    leaks: serverLeaks,
    ok: missing.length === 0 && warnings.length === 0,
  };
  console.log(JSON.stringify(report, null, 2));
  exit(report.ok ? 0 : 1);
} catch (err) {
  console.error("fetch failed:", err?.message ?? err);
  exit(2);
}
