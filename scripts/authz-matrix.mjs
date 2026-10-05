#!/usr/bin/env node
// Dumps the full authz matrix from the server's policy module as a flat
// table, so an internal reviewer can diff it between commits. We import
// the compiled policy at runtime so this never falls behind the code —
// the output is "what the server will actually enforce right now".
//
// Usage: node scripts/authz-matrix.mjs
//        node scripts/authz-matrix.mjs --json

import { argv, exit } from "node:process";

const url = new URL("../server/dist/policy/index.js", import.meta.url);
let mod;
try {
  mod = await import(url.href);
} catch {
  console.error(
    "Compiled policy not found. Run `npm --prefix server run build` first."
  );
  exit(2);
}

const { can } = mod;

const ROLES = [
  "anon",
  "founder",
  "director",
  "project_manager",
  "finance_manager",
  "media_manager",
  "field_member",
  "supporter",
];

const ACTIONS = [
  "admin.open",
  "users.read",
  "users.invite",
  "users.assign_role",
  "users.revoke_role",
  "users.suspend",
  "users.reinstate",
  "audit.read",
  "communities.read",
  "communities.create",
  "communities.update",
  "field.open",
  "finance.read",
  "finance.write",
  "media.publish",
  "media.upload",
  "media.read_internal",
  "projects.read",
  "projects.create",
  "projects.update",
  "projects.archive",
  "accomplishments.author",
  "accomplishments.read",
  "accomplishments.review",
  "accomplishments.approve",
  "accomplishments.publish",
  "accomplishments.archive",
  "metrics.read",
  "metrics.write_definition",
  "metrics.write_entry",
];

const rows = [];
for (const action of ACTIONS) {
  for (const role of ROLES) {
    const actor = {
      user_id: "u1",
      organization_id: "o1",
      mfa_verified: true,
      assignments:
        role === "anon" ? [] : [{ role, scope_type: "organization", scope_id: null }],
    };
    const resource =
      action.startsWith("finance.")
        ? { kind: "finance", organization_id: "o1" }
        : action.startsWith("self.")
          ? { kind: "self", user_id: "u1" }
          : { kind: "none" };
    rows.push({ action, role, allowed: can(actor, action, resource) });
  }
}

if (argv.includes("--json")) {
  console.log(JSON.stringify(rows, null, 2));
  exit(0);
}

const widths = {
  action: Math.max(6, ...rows.map((r) => r.action.length)),
  role: Math.max(4, ...ROLES.map((r) => r.length)),
};
const pad = (s, w) => String(s).padEnd(w, " ");

console.log(pad("action", widths.action) + " | " + pad("role", widths.role) + " | allowed");
console.log("-".repeat(widths.action) + "-+-" + "-".repeat(widths.role) + "-+-" + "-".repeat(7));
for (const r of rows) {
  console.log(
    pad(r.action, widths.action) +
      " | " +
      pad(r.role, widths.role) +
      " | " +
      (r.allowed ? "yes" : "no")
  );
}
