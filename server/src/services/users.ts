import crypto from "node:crypto";
import mongoose from "mongoose";
import { env } from "@/config/env.js";
import { AppError } from "@/util/errors.js";
import { User, RoleAssignment, Organization, type Role } from "@/models/index.js";
import { ROLES } from "@/models/RoleAssignment.js";
import { canGrantRole } from "@/policy/index.js";
import type { Actor } from "@/policy/index.js";
import { writeAudit } from "./audit.js";
import { enqueue } from "./outbox.js";
import { inviteToken } from "@/util/ids.js";
import { hashPassword } from "@/auth/passwords.js";

export type RequestCtx = {
  ip: string;
  user_agent: string;
  request_id: string;
};

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function toObjectId(id: string, field: string): mongoose.Types.ObjectId {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("bad_request", `invalid ${field}`);
  }
  return new mongoose.Types.ObjectId(id);
}

export async function inviteUser(
  actor: Actor,
  input: { email: string; display_name: string; role: Role; scope_type: "organization" | "community" | "project"; scope_id: string | null },
  ctx: RequestCtx
): Promise<{ user_id: string; token: string }> {
  if (!canGrantRole(actor, input.role)) {
    throw new AppError("forbidden", "you can't grant that role");
  }
  if (!ROLES.includes(input.role)) throw new AppError("bad_request", "unknown role");
  if (input.scope_type !== "organization" && !input.scope_id) {
    throw new AppError("bad_request", "scope_id is required for non-organization scopes");
  }

  const org_id = toObjectId(actor.organization_id, "organization_id");
  const actor_id = toObjectId(actor.user_id, "actor");
  const scope_id = input.scope_id ? toObjectId(input.scope_id, "scope_id") : null;

  const org = await Organization.findById(org_id).lean();
  if (!org) throw new AppError("not_found", "organization not found");

  const email = input.email.toLowerCase().trim();
  const token = inviteToken();
  const token_hash = sha256(token);
  const expires_at = new Date(Date.now() + INVITE_TTL_MS);

  const session = await mongoose.startSession();
  try {
    let user_id!: mongoose.Types.ObjectId;
    await session.withTransaction(async () => {
      // Upsert: if the email already exists in this org and is pending, we
      // refresh the invite; if active or suspended, we refuse.
      const existing = await User.findOne({ organization_id: org_id, email }).session(session);
      if (existing && existing.status !== "pending") {
        throw new AppError("conflict", "a user with that email already exists");
      }

      if (existing) {
        existing.display_name = input.display_name.trim().slice(0, 120);
        existing.invite_token_hash = token_hash;
        existing.invite_expires_at = expires_at;
        existing.invited_by = actor_id;
        existing.version = (existing.version ?? 0) + 1;
        await existing.save({ session });
        user_id = existing._id;
      } else {
        const [u] = await User.create(
          [
            {
              organization_id: org_id,
              email,
              display_name: input.display_name.trim().slice(0, 120),
              password_hash: null,
              status: "pending",
              invited_by: actor_id,
              invite_token_hash: token_hash,
              invite_expires_at: expires_at,
            },
          ],
          { session }
        );
        user_id = u._id;
      }

      // Assign the role in the same transaction. Services never trust the
      // role field from the request body (policy already decided this).
      await RoleAssignment.create(
        [
          {
            organization_id: org_id,
            user_id,
            role: input.role,
            scope_type: input.scope_type,
            scope_id,
            granted_by: actor_id,
            granted_at: new Date(),
          },
        ],
        { session }
      );

      await writeAudit(
        {
          organization_id: org_id,
          actor_id,
          actor_role: input.role,
          action: "user.invite",
          entity_type: "user",
          entity_id: user_id,
          after: { email, role: input.role, scope_type: input.scope_type, scope_id },
          ip: ctx.ip,
          user_agent: ctx.user_agent,
          request_id: ctx.request_id,
        },
        session
      );

      await enqueue(
        {
          organization_id: org_id,
          topic: "mail.invite",
          payload: {
            to: email,
            invitee_name: input.display_name,
            inviter_name: "the Sarah's Foundation team",
            organization_name: org.name,
            accept_url: `${env.PUBLIC_SITE_URL}/invite/accept/${token}`,
            expires_at: expires_at.toISOString(),
          },
        },
        session
      );
    });
    return { user_id: user_id.toString(), token };
  } finally {
    await session.endSession();
  }
}

export async function assignRole(
  actor: Actor,
  input: { user_id: string; role: Role; scope_type: "organization" | "community" | "project"; scope_id: string | null },
  ctx: RequestCtx
): Promise<void> {
  if (!canGrantRole(actor, input.role)) {
    throw new AppError("forbidden", "you can't grant that role");
  }
  if (!ROLES.includes(input.role)) throw new AppError("bad_request", "unknown role");

  const org_id = toObjectId(actor.organization_id, "organization_id");
  const actor_id = toObjectId(actor.user_id, "actor");
  const target_id = toObjectId(input.user_id, "user_id");
  const scope_id = input.scope_id ? toObjectId(input.scope_id, "scope_id") : null;

  const target = await User.findOne({ _id: target_id, organization_id: org_id }).lean();
  if (!target) throw new AppError("not_found", "user not found");

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const existing = await RoleAssignment.findOne({
        organization_id: org_id,
        user_id: target_id,
        role: input.role,
        scope_type: input.scope_type,
        scope_id,
        revoked_at: null,
      }).session(session);
      if (existing) {
        throw new AppError("conflict", "already assigned");
      }
      await RoleAssignment.create(
        [
          {
            organization_id: org_id,
            user_id: target_id,
            role: input.role,
            scope_type: input.scope_type,
            scope_id,
            granted_by: actor_id,
            granted_at: new Date(),
          },
        ],
        { session }
      );
      await writeAudit(
        {
          organization_id: org_id,
          actor_id,
          actor_role: input.role,
          action: "user.assign_role",
          entity_type: "user",
          entity_id: target_id,
          after: { role: input.role, scope_type: input.scope_type, scope_id },
          ip: ctx.ip,
          user_agent: ctx.user_agent,
          request_id: ctx.request_id,
        },
        session
      );
    });
  } finally {
    await session.endSession();
  }
}

export async function revokeRole(
  actor: Actor,
  input: { assignment_id: string },
  ctx: RequestCtx
): Promise<void> {
  const org_id = toObjectId(actor.organization_id, "organization_id");
  const actor_id = toObjectId(actor.user_id, "actor");
  const asg_id = toObjectId(input.assignment_id, "assignment_id");

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const asg = await RoleAssignment.findOne({ _id: asg_id, organization_id: org_id }).session(session);
      if (!asg) throw new AppError("not_found", "assignment not found");
      if (asg.revoked_at) throw new AppError("conflict", "already revoked");
      if (!canGrantRole(actor, asg.role)) {
        throw new AppError("forbidden", "you can't revoke that role");
      }
      asg.revoked_at = new Date();
      asg.revoked_by = actor_id;
      await asg.save({ session });

      await writeAudit(
        {
          organization_id: org_id,
          actor_id,
          actor_role: asg.role,
          action: "user.revoke_role",
          entity_type: "role_assignment",
          entity_id: asg._id,
          before: { role: asg.role, scope_type: asg.scope_type, scope_id: asg.scope_id },
          ip: ctx.ip,
          user_agent: ctx.user_agent,
          request_id: ctx.request_id,
        },
        session
      );
    });
  } finally {
    await session.endSession();
  }
}

export async function setUserStatus(
  actor: Actor,
  input: { user_id: string; status: "active" | "suspended" },
  ctx: RequestCtx
): Promise<void> {
  const org_id = toObjectId(actor.organization_id, "organization_id");
  const actor_id = toObjectId(actor.user_id, "actor");
  const target_id = toObjectId(input.user_id, "user_id");
  if (target_id.equals(actor_id)) {
    throw new AppError("bad_request", "you cannot change your own status");
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const user = await User.findOne({ _id: target_id, organization_id: org_id }).session(session);
      if (!user) throw new AppError("not_found", "user not found");
      const before = { status: user.status };
      user.status = input.status;
      user.version = (user.version ?? 0) + 1;
      await user.save({ session });
      await writeAudit(
        {
          organization_id: org_id,
          actor_id,
          actor_role: null,
          action: input.status === "suspended" ? "user.suspend" : "user.reinstate",
          entity_type: "user",
          entity_id: user._id,
          before,
          after: { status: user.status },
          ip: ctx.ip,
          user_agent: ctx.user_agent,
          request_id: ctx.request_id,
        },
        session
      );
    });
  } finally {
    await session.endSession();
  }
}

export async function acceptInvite(
  token: string,
  password: string,
  ctx: RequestCtx
): Promise<{ user_id: string; organization_id: string }> {
  if (!token) throw new AppError("bad_request", "token is required");
  const token_hash = sha256(token);
  const user = await User.findOne({ invite_token_hash: token_hash, status: "pending" });
  if (!user) throw new AppError("not_found", "invitation not found");
  if (!user.invite_expires_at || user.invite_expires_at.getTime() < Date.now()) {
    throw new AppError("conflict", "invitation expired");
  }

  const hash = await hashPassword(password);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      user.password_hash = hash;
      user.status = "active";
      user.invite_token_hash = null;
      user.invite_expires_at = null;
      user.version = (user.version ?? 0) + 1;
      await user.save({ session });

      await writeAudit(
        {
          organization_id: user.organization_id,
          actor_id: user._id,
          actor_role: null,
          action: "user.invite_accepted",
          entity_type: "user",
          entity_id: user._id,
          ip: ctx.ip,
          user_agent: ctx.user_agent,
          request_id: ctx.request_id,
        },
        session
      );
    });
  } finally {
    await session.endSession();
  }

  return { user_id: user._id.toString(), organization_id: user.organization_id.toString() };
}
