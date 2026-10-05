import { connectDB, disconnectDB } from "@/config/db.js";
import { runIntegrity } from "@/services/integrity.js";
import { log } from "@/util/log.js";

// Run the finance integrity suite from the command line. Intended to be
// scheduled nightly by cron / systemd timer. Non-zero exit on failure so
// the scheduler alerts.

async function main(): Promise<void> {
  await connectDB();
  const r = await runIntegrity();
  await disconnectDB();
  if (!r.ok) {
    log.error({ reports: r.reports }, "integrity.failed");
    process.exit(2);
  }
  log.info({ reports: r.reports }, "integrity.ok");
}

main().catch((err) => {
  log.error({ err: err instanceof Error ? err.message : "unknown" }, "integrity.crashed");
  process.exit(1);
});
