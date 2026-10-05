import mongoose from "mongoose";
import { log } from "@/util/log.js";

// =============================================================================
// Database users (§9.4). Five least-privilege roles. The migration prints
// explicit guidance when it is run against an unmanaged / local Mongo (where
// `createRole` requires admin credentials); on managed Atlas the DBA creates
// the equivalents from the Atlas UI using the privileges below.
// =============================================================================

export const name = "0002_db_users";

type Priv = { resource: { db: string; collection: string }; actions: string[] };

const DB = process.env.MONGO_DB_NAME ?? "sfuganda";

const APPEND_ONLY = ["audit_log", "approval_events", "ledger_entries", "stripe_events"];

const privs = {
  // API user — read/write on workflow collections; append-only elsewhere.
  api: [
    // read everywhere in our database
    { resource: { db: DB, collection: "" }, actions: ["find"] },
    // write on the normal collections (everything except the append-only ones)
    ...[
      "organizations",
      "users",
      "role_assignments",
      "sessions",
      "outbox_events",
      "communities",
      "id_sequences",
      "volunteer_signups",
    ].map((c) => ({
      resource: { db: DB, collection: c },
      actions: ["insert", "update", "remove", "createIndex"],
    })),
    // append-only: insert only. No update, no remove — enforced in Mongo.
    ...APPEND_ONLY.map((c) => ({
      resource: { db: DB, collection: c },
      actions: ["insert"],
    })),
  ] satisfies Priv[],

  // Public-read — only find on explicitly named "public_*" views.
  publicRead: [
    { resource: { db: DB, collection: "" }, actions: [] },
  ] satisfies Priv[],

  // Beneficiary (private DB only — not managed here beyond a stub).
  beneficiary: [] as Priv[],

  // Worker user: read + insert into outbox_events, append to audit_log,
  // update/complete events but never update any append-only collection.
  worker: [
    { resource: { db: DB, collection: "outbox_events" }, actions: ["find", "update"] },
    ...APPEND_ONLY.map((c) => ({ resource: { db: DB, collection: c }, actions: ["insert"] })),
  ] satisfies Priv[],

  // Migration user: full control, used only by this process.
  migrate: [
    { resource: { db: DB, collection: "" }, actions: ["find", "insert", "update", "remove", "createIndex", "dropCollection", "listCollections", "collMod"] },
  ] satisfies Priv[],
};

export async function up(): Promise<void> {
  const admin = mongoose.connection.db?.admin();
  if (!admin) {
    log.warn("migration.db_users.no_admin");
    return;
  }

  const roles: Array<{ name: string; privileges: Priv[] }> = [
    { name: "sfu_api_role", privileges: privs.api },
    { name: "sfu_public_read_role", privileges: privs.publicRead },
    { name: "sfu_beneficiary_role", privileges: privs.beneficiary },
    { name: "sfu_worker_role", privileges: privs.worker },
    { name: "sfu_migrate_role", privileges: privs.migrate },
  ];

  for (const role of roles) {
    try {
      await admin.command({
        createRole: role.name,
        privileges: role.privileges,
        roles: [],
      });
      log.info({ role: role.name }, "migration.role_created");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      if (/already exists|Role.*already/i.test(msg)) {
        try {
          await admin.command({
            updateRole: role.name,
            privileges: role.privileges,
            roles: [],
          });
          log.info({ role: role.name }, "migration.role_updated");
        } catch (updateErr) {
          const umsg = updateErr instanceof Error ? updateErr.message : "unknown";
          log.warn({ role: role.name, err: umsg }, "migration.role_update_failed");
        }
      } else if (/not authorized|requires authentication|not allowed/i.test(msg)) {
        log.warn(
          { role: role.name },
          "migration.role_skipped (not admin — create the five Atlas roles manually; privileges printed to stdout)"
        );
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(role, null, 2));
      } else {
        throw err;
      }
    }
  }
}
