import mongoose from "mongoose";
import { env } from "@/config/env.js";
import { log } from "@/util/log.js";

mongoose.set("strictQuery", "throw");
// Fail loud if someone saves a field not in the schema (§9.4).
mongoose.set("strict", "throw");

let connected = false;

export async function connectDB(uri = env.MONGO_URI): Promise<typeof mongoose> {
  if (connected) return mongoose;
  await mongoose.connect(uri, {
    dbName: env.MONGO_DB_NAME,
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 20,
  });
  connected = true;
  log.info({ db: env.MONGO_DB_NAME }, "mongodb connected");
  return mongoose;
}

export async function disconnectDB(): Promise<void> {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
}

export function isConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
