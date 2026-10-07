import mongoose from "mongoose";
import { connectDB, disconnectDB } from "@/config/db.js";
import { log } from "@/util/log.js";
import * as m0001 from "./0001_initial.js";
import * as m0002 from "./0002_db_users.js";
import * as m0003 from "./0003_media.js";
import * as m0004 from "./0004_projects.js";
import * as m0005 from "./0005_finance.js";
import * as m0006 from "./0006_finance_phase6.js";
import * as m0007 from "./0007_supporters.js";
import * as m0008 from "./0008_phase8.js";
import * as m0009 from "./0009_reports.js";
import * as m0010 from "./0010_phase10.js";
import * as m0011 from "./0011_phase11.js";
import * as m0012 from "./0012_phase12.js";
import * as m0013 from "./0013_phase13.js";

type Migration = { name: string; up: () => Promise<void> };

const MIGRATIONS: Migration[] = [m0001, m0002, m0003, m0004, m0005, m0006, m0007, m0008, m0009, m0010, m0011, m0012, m0013];

const COLL = "schema_migrations";

async function main(): Promise<void> {
  await connectDB();
  const db = mongoose.connection.db!;
  const applied = new Set<string>(
    (await db.collection(COLL).find({}, { projection: { name: 1 } }).toArray()).map((r) => r.name)
  );

  for (const m of MIGRATIONS) {
    if (applied.has(m.name)) {
      log.info({ migration: m.name }, "migration.skip");
      continue;
    }
    log.info({ migration: m.name }, "migration.apply");
    await m.up();
    await db.collection(COLL).insertOne({ name: m.name, applied_at: new Date() });
    log.info({ migration: m.name }, "migration.done");
  }

  await disconnectDB();
}

main().catch((err) => {
  log.error({ err: err instanceof Error ? err.message : "unknown" }, "migration.failed");
  process.exit(1);
});
