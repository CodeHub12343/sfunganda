import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";

// Set required env BEFORE loading app code — config/env.ts validates on
// import and will exit otherwise.
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "error";
process.env.SESSION_SECRET = "test-secret-at-least-32-chars-long-xx";
process.env.INTERNAL_PROXY_SECRET = "internal-test-secret-xxxxx";
process.env.MAIL_FROM = "noreply@test.local";
process.env.SMTP_HOST = "localhost";
process.env.PUBLIC_SITE_URL = "http://localhost:3000";
process.env.CORS_ORIGINS = "http://localhost:3000";

let replSet: MongoMemoryReplSet | null = null;

export async function startTestDB(): Promise<string> {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  process.env.MONGO_URI = uri;
  process.env.MONGO_DB_NAME = "sfuganda_test";
  await mongoose.connect(uri, { dbName: "sfuganda_test" });
  return uri;
}

export async function stopTestDB(): Promise<void> {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
  replSet = null;
}

export async function clearTestDB(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;
  const colls = await db.listCollections().toArray();
  await Promise.all(colls.map((c) => db.collection(c.name).deleteMany({})));
}
