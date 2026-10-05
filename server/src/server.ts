import { env } from "@/config/env.js";
import { connectDB, disconnectDB } from "@/config/db.js";
import { log } from "@/util/log.js";
import { buildApp } from "./app.js";

async function main(): Promise<void> {
  await connectDB();
  const app = buildApp();
  const server = app.listen(env.PORT, () => {
    log.info({ port: env.PORT }, "api.listening");
  });

  const stop = async (signal: string) => {
    log.info({ signal }, "api.shutting_down");
    server.close(async (err) => {
      if (err) {
        log.error({ err: err.message }, "api.close_failed");
        process.exit(1);
      }
      await disconnectDB();
      process.exit(0);
    });
    // Hard limit so we never hang forever on shutdown.
    setTimeout(() => {
      log.error("api.force_exit");
      process.exit(1);
    }, 15_000).unref();
  };

  process.on("SIGINT", () => void stop("SIGINT"));
  process.on("SIGTERM", () => void stop("SIGTERM"));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("api.startup_failed:", err);
  process.exit(1);
});
