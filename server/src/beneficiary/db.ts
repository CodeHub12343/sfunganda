import mongoose from "mongoose";
import { env } from "@/config/env.js";
import { log } from "@/util/log.js";
import { AppError } from "@/util/errors.js";

// =============================================================================
// Phase 11 — Private database connection for beneficiary records.
//
// Design rules (§8, §19.3):
//   • This file is the ONLY place in the codebase that touches
//     MONGO_URI_PRIVATE / MONGO_DB_NAME_PRIVATE. Anything that wants to
//     read or write beneficiary data goes through the service in this
//     folder.
//   • The connection is created lazily on first authorised call. If the
//     env is unset, the module stays dormant and callers get a 503. We
//     never fall back to the main connection.
//   • The driver uses the dedicated database user whose credentials are
//     embedded in MONGO_URI_PRIVATE. In Atlas that user has access to
//     the private database only.
//   • `strict: "throw"` and `strictQuery: "throw"` on this connection
//     too, so a typo on a projected field cannot silently return the
//     whole document.
// =============================================================================

let conn: mongoose.Connection | null = null;
let connecting: Promise<mongoose.Connection> | null = null;

export function privateDbConfigured(): boolean {
  return Boolean(env.MONGO_URI_PRIVATE) && Boolean(env.FIELD_ENCRYPTION_KEY);
}

export async function getPrivateConnection(): Promise<mongoose.Connection> {
  if (!env.BENEFICIARY_LEGAL_SIGNOFF) {
    // Hard gate (§8 "legal-gated"). The DoD is "legal sign-off on file" —
    // operations flip BENEFICIARY_LEGAL_SIGNOFF=true when the signed
    // documentation exists. Without it, we refuse to open the connection
    // at all so a misconfiguration cannot leak records.
    throw new AppError(
      "unavailable",
      "children's fund is not enabled on this environment (legal sign-off required)"
    );
  }
  if (!privateDbConfigured()) {
    throw new AppError("unavailable", "children's fund is not configured");
  }
  if (conn && conn.readyState === 1) return conn;
  if (connecting) return connecting;
  connecting = (async () => {
    const c = mongoose.createConnection(env.MONGO_URI_PRIVATE!, {
      dbName: env.MONGO_DB_NAME_PRIVATE,
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 5,
      // The private module is low-volume. A small pool avoids holding
      // sockets open to a sensitive database.
    });
    c.set("strictQuery", "throw");
    c.set("strict", "throw");
    await c.asPromise();
    log.info({ db: env.MONGO_DB_NAME_PRIVATE }, "private_db.connected");
    conn = c;
    return c;
  })();
  try {
    return await connecting;
  } finally {
    connecting = null;
  }
}

export async function disconnectPrivate(): Promise<void> {
  if (!conn) return;
  await conn.close();
  conn = null;
}

// Guard used by tests to force a specific connection (e.g. the shared
// in-memory replica set that the main setup already starts). Never called
// in production code paths.
export function setPrivateConnectionForTests(c: mongoose.Connection | null): void {
  conn = c;
}
