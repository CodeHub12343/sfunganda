import mongoose from "mongoose";
import { OutboxEvent } from "@/models/index.js";

// Enqueue an outbox event inside the same transaction as the state change.
export async function enqueue(
  input: {
    organization_id: mongoose.Types.ObjectId;
    topic: string;
    payload: Record<string, unknown>;
    available_at?: Date;
  },
  session?: mongoose.ClientSession
): Promise<void> {
  await OutboxEvent.create(
    [
      {
        organization_id: input.organization_id,
        topic: input.topic,
        payload: input.payload,
        available_at: input.available_at ?? new Date(),
        status: "pending",
        attempts: 0,
      },
    ],
    session ? { session } : {}
  );
}
