import mongoose from "mongoose";
import { log } from "@/util/log.js";
import { env } from "@/config/env.js";
import { AppError } from "@/util/errors.js";
import * as m0001 from "./0001_private.js";

type Migration = { name: string; up: (conn: mongoose.Connection) => Promise<void> };

const MIGRATIONS: Migration[] = [m0001];
const COLL = "schema_migrations_private";

async function main(): Promise<void> {
  if (!env.MONGO_URI_PRIVATE) {
    throw new AppError("unavailable", "MONGO_URI_PRIVATE is not set");
  }
  const conn = mongoose.createConnection(env.MONGO_URI_PRIVATE, {
    dbName: env.MONGO_DB_NAME_PRIVATE,
    serverSelectionTimeoutMS: 10_000,
  });
  await conn.asPromise();

  const db = conn.db!;
  const applied = new Set<string>(
    (await db.collection(COLL).find({}, { projection: { name: 1 } }).toArray()).map((r) => r.name)
  );

  for (const m of MIGRATIONS) {
    if (applied.has(m.name)) {
      log.info({ migration: m.name }, "private_migration.skip");
      continue;
    }
    log.info({ migration: m.name }, "private_migration.apply");
    await m.up(conn);
    await db.collection(COLL).insertOne({ name: m.name, applied_at: new Date() });
    log.info({ migration: m.name }, "private_migration.done");
  }

  await conn.close();
}

main().catch((err) => {
  log.error({ err: err instanceof Error ? err.message : "unknown" }, "private_migration.failed");
  process.exit(1);
});
