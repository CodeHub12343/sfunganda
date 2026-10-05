import { connectDB } from "@/config/db.js";
import { log } from "@/util/log.js";
import { OutboxEvent } from "@/models/index.js";
import { getHandler } from "./handlers.js";

// =============================================================================
// Outbox worker (§18). Claims one event at a time with findOneAndUpdate so
// multiple workers can run safely. Backoff is exponential, capped at 1 hour.
// =============================================================================

const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 2_000);
const LOCK_MS = Number(process.env.WORKER_LOCK_MS ?? 60_000);
const MAX_ATTEMPTS = Number(process.env.WORKER_MAX_ATTEMPTS ?? 10);

let stopping = false;

function backoff(attempts: number): Date {
  const base = Math.min(60 * 60 * 1000, 2 ** attempts * 1000);
  // Jitter to avoid thundering herd on failure.
  const jitter = Math.floor(Math.random() * 1000);
  return new Date(Date.now() + base + jitter);
}

async function tick(): Promise<boolean> {
  const now = new Date();
  const claimed = await OutboxEvent.findOneAndUpdate(
    {
      status: "pending",
      available_at: { $lte: now },
      $or: [{ locked_until: null }, { locked_until: { $lte: now } }],
    },
    {
      $set: {
        status: "in_progress",
        locked_until: new Date(Date.now() + LOCK_MS),
      },
      $inc: { attempts: 1 },
    },
    { new: true, sort: { available_at: 1 } }
  );

  if (!claimed) return false;

  const handler = getHandler(claimed.topic);
  if (!handler) {
    log.error({ event_id: claimed._id.toString(), topic: claimed.topic }, "outbox.no_handler");
    await OutboxEvent.updateOne(
      { _id: claimed._id },
      { $set: { status: "failed", last_error: "no_handler", locked_until: null } }
    );
    return true;
  }

  try {
    await handler(claimed.payload as Record<string, unknown>, {
      event_id: claimed._id.toString(),
      organization_id: claimed.organization_id,
    });
    await OutboxEvent.updateOne(
      { _id: claimed._id },
      { $set: { status: "done", locked_until: null, last_error: null } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    log.error({ event_id: claimed._id.toString(), err: msg }, "outbox.handler_failed");
    if (claimed.attempts >= MAX_ATTEMPTS) {
      await OutboxEvent.updateOne(
        { _id: claimed._id },
        { $set: { status: "failed", last_error: msg, locked_until: null } }
      );
    } else {
      await OutboxEvent.updateOne(
        { _id: claimed._id },
        {
          $set: {
            status: "pending",
            last_error: msg,
            locked_until: null,
            available_at: backoff(claimed.attempts),
          },
        }
      );
    }
  }
  return true;
}

async function main(): Promise<void> {
  await connectDB();
  log.info("worker.start");

  const stop = () => {
    log.info("worker.stopping");
    stopping = true;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  while (!stopping) {
    const did = await tick();
    if (!did) await new Promise((r) => setTimeout(r, POLL_MS));
  }
  log.info("worker.stopped");
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    log.error({ err: err instanceof Error ? err.message : "unknown" }, "worker.crashed");
    process.exit(1);
  });
}

export { tick };
