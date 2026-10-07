import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

// =============================================================================
// C5 — "Private beneficiary information requested through a public endpoint".
// This test is a STATIC scan: it walks every file under `src/routes` and the
// public-facing services (anything that is reached without an authenticated
// request), and asserts none of them imports from the private module.
//
// The invariant we're protecting (DoD §Phase 11):
//   "No query path from a public endpoint to the private database."
//
// How it works:
//   • Public roots are the files under src/routes that the Express app
//     mounts under `/v1/public/*` and the services they transitively use.
//   • The scan reads source as text (no runtime execution) and looks for
//     any `from "@/beneficiary/..."` import or a relative one into
//     src/beneficiary/.
// =============================================================================

const SERVER_ROOT = path.resolve(__dirname, "..");
const PUBLIC_ROUTE_FILES = [
  "src/routes/publicPortal.ts",
  "src/routes/publicChildrenFund.ts",
  "src/routes/videoSummaries.ts",
  "src/routes/stripeWebhook.ts",
  "src/routes/mediaWebhooks.ts",
  "src/routes/health.ts",
  "src/routes/supporters.ts",
  "src/routes/donations.ts",
  "src/routes/volunteers.ts",
  "src/routes/videos.ts",
];

const FORBIDDEN_PATTERNS = [
  /from\s+["']@\/beneficiary\//,
  /from\s+["']\.\.?\/.*beneficiary\//, // relative hop
  /require\(\s*["']@\/beneficiary\//,
];

// Transitively collect imports starting at a seed file. We stay within
// server/src and skip anything already visited. The private module tree
// is explicitly NOT walked — if a public file names it, we flag the file.
function imports(file: string, seen: Set<string>): void {
  if (seen.has(file)) return;
  seen.add(file);
  let src: string;
  try {
    src = readFileSync(file, "utf8");
  } catch {
    return;
  }
  for (const pat of FORBIDDEN_PATTERNS) {
    if (pat.test(src)) {
      throw new Error(`FORBIDDEN: ${path.relative(SERVER_ROOT, file)} imports from the private module`);
    }
  }
  for (const m of src.matchAll(/from\s+["']([^"']+)["']/g)) {
    const spec = m[1]!;
    let resolved: string | null = null;
    if (spec.startsWith("@/")) {
      resolved = path.join(SERVER_ROOT, "src", spec.slice(2));
    } else if (spec.startsWith(".")) {
      resolved = path.resolve(path.dirname(file), spec);
    }
    if (!resolved) continue;
    if (resolved.includes(`${path.sep}beneficiary${path.sep}`)) {
      throw new Error(
        `FORBIDDEN: ${path.relative(SERVER_ROOT, file)} resolves to the private module (${spec})`
      );
    }
    // Try .ts / .js / /index.ts
    const candidates = [
      resolved + ".ts",
      resolved + ".js",
      resolved.replace(/\.js$/, ".ts"),
      path.join(resolved, "index.ts"),
    ];
    for (const c of candidates) {
      try {
        if (statSync(c).isFile()) {
          imports(c, seen);
          break;
        }
      } catch {
        /* keep searching */
      }
    }
  }
}

describe("C5 — public <-> private isolation", () => {
  for (const file of PUBLIC_ROUTE_FILES) {
    it(`${file} and its transitive imports never reach src/beneficiary/`, () => {
      const abs = path.join(SERVER_ROOT, file);
      expect(() => imports(abs, new Set())).not.toThrow();
    });
  }

  it("the private module directory exists and is only imported from itself", () => {
    const dir = path.join(SERVER_ROOT, "src", "beneficiary");
    expect(statSync(dir).isDirectory()).toBe(true);
    // Any file in server/src/* that imports from @/beneficiary/* MUST
    // itself live in src/beneficiary/ or src/routes/beneficiaries.ts, or
    // be a test. The scan here enforces that policy.
    const forbidden = /from\s+["']@\/beneficiary\//;
    function* walk(dir: string): Iterable<string> {
      for (const name of readdirSync(dir)) {
        const p = path.join(dir, name);
        const s = statSync(p);
        if (s.isDirectory()) {
          if (p.includes(`${path.sep}node_modules${path.sep}`)) continue;
          yield* walk(p);
        } else if (p.endsWith(".ts")) {
          yield p;
        }
      }
    }
    const srcDir = path.join(SERVER_ROOT, "src");
    const violations: string[] = [];
    for (const file of walk(srcDir)) {
      if (file.includes(`${path.sep}beneficiary${path.sep}`)) continue;
      if (file.endsWith(`${path.sep}routes${path.sep}beneficiaries.ts`)) continue;
      const src = readFileSync(file, "utf8");
      if (forbidden.test(src)) violations.push(path.relative(SERVER_ROOT, file));
    }
    expect(violations).toEqual([]);
  });
});
