import mongoose from "mongoose";
import { AuditLog } from "@/models/index.js";

// =============================================================================
// Audit writer. The service layer passes the active transaction `session`
// so the audit row is written together with the change. Append-only is
// enforced by the database privilege model (`find` + `insert` only).
// =============================================================================

export type AuditInput = {
  organization_id: mongoose.Types.ObjectId;
  actor_id: mongoose.Types.ObjectId | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: mongoose.Types.ObjectId | string | null;
  before?: unknown;
  after?: unknown;
  ip?: string;
  user_agent?: string;
  request_id?: string;
};

export async function writeAudit(
  input: AuditInput,
  session?: mongoose.ClientSession
): Promise<void> {
  await AuditLog.create(
    [
      {
        organization_id: input.organization_id,
        actor_id: input.actor_id,
        actor_role: input.actor_role,
        action: input.action,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        before: input.before ?? null,
        after: input.after ?? null,
        ip: input.ip ?? "",
        user_agent: input.user_agent ?? "",
        request_id: input.request_id ?? "",
        at: new Date(),
      },
    ],
    session ? { session } : {}
  );
}
