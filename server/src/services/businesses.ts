import mongoose from "mongoose";
import { AppError } from "@/util/errors.js";
import { Business, Community } from "@/models/index.js";
import type { BusinessKind, BusinessStatus } from "@/models/Business.js";
import type { Actor } from "@/policy/index.js";
import { can } from "@/policy/index.js";
import { writeAudit } from "./audit.js";
import type { RequestCtx } from "./users.js";

// =============================================================================
// Business services (Phase 8). CRUD + approval. All writes run in a single
// transaction with the audit row. No business logic lives in the route layer.
// =============================================================================

function toObjectId(id: string, field: string): mongoose.Types.ObjectId {
  if (!mongoose.isValidObjectId(id)) throw new AppError("bad_request", `invalid ${field}`);
  return new mongoose.Types.ObjectId(id);
}

export type BusinessInput = {
  slug: string;
  name: string;
  kind: BusinessKind;
  summary?: string;
  community_id?: string | null;
  manager_id?: string | null;
  fund_id?: string | null;
  status?: BusinessStatus;
};

export async function createBusiness(
  actor: Actor,
  input: BusinessInput,
  ctx: RequestCtx
): Promise<{ id: string }> {
  if (!can(actor, "businesses.create")) throw new AppError("forbidden", "forbidden");
  const org_id = toObjectId(actor.organization_id, "organization_id");
  const actor_id = toObjectId(actor.user_id, "actor");
  const community_id = input.community_id ? toObjectId(input.community_id, "community_id") : null;
  const manager_id = input.manager_id ? toObjectId(input.manager_id, "manager_id") : null;
  const fund_id = input.fund_id ? toObjectId(input.fund_id, "fund_id") : null;

  if (community_id) {
    const exists = await Community.exists({ _id: community_id, organization_id: org_id });
    if (!exists) throw new AppError("bad_request", "community not found");
  }

  const session = await mongoose.startSession();
  try {
    let id!: mongoose.Types.ObjectId;
    await session.withTransaction(async () => {
      const dup = await Business.findOne({ organization_id: org_id, slug: input.slug }).session(session);
      if (dup) throw new AppError("conflict", "slug already taken");
      const [doc] = await Business.create(
        [
          {
            organization_id: org_id,
            community_id,
            slug: input.slug,
            name: input.name,
            kind: input.kind,
            summary: input.summary ?? "",
            manager_id,
            fund_id,
            status: input.status ?? "planned",
            public_visibility: "internal",
          },
        ],
        { session }
      );
      id = doc._id;
      await writeAudit(
        {
          organization_id: org_id,
          actor_id,
          actor_role: null,
          action: "business.create",
          entity_type: "business",
          entity_id: id,
          after: { slug: input.slug, kind: input.kind, status: input.status ?? "planned" },
          ip: ctx.ip,
          user_agent: ctx.user_agent,
          request_id: ctx.request_id,
        },
        session
      );
    });
    return { id: id.toString() };
  } finally {
    await session.endSession();
  }
}

export async function updateBusiness(
  actor: Actor,
  id: string,
  patch: Partial<BusinessInput> & { version: number },
  ctx: RequestCtx
): Promise<void> {
  if (!can(actor, "businesses.update")) throw new AppError("forbidden", "forbidden");
  const org_id = toObjectId(actor.organization_id, "organization_id");
  const actor_id = toObjectId(actor.user_id, "actor");
  const biz_id = toObjectId(id, "business_id");

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const biz = await Business.findOne({ _id: biz_id, organization_id: org_id }).session(session);
      if (!biz) throw new AppError("not_found", "business not found");
      if (biz.version !== patch.version) throw new AppError("version_conflict", "stale version");

      const before = {
        name: biz.name,
        kind: biz.kind,
        summary: biz.summary,
        status: biz.status,
        community_id: biz.community_id?.toString() ?? null,
      };

      if (patch.name !== undefined) biz.name = patch.name;
      if (patch.kind !== undefined) biz.kind = patch.kind;
      if (patch.summary !== undefined) biz.summary = patch.summary;
      if (patch.status !== undefined) biz.status = patch.status;
      if (patch.community_id !== undefined) {
        biz.community_id = patch.community_id ? toObjectId(patch.community_id, "community_id") : null;
      }
      if (patch.manager_id !== undefined) {
        biz.manager_id = patch.manager_id ? toObjectId(patch.manager_id, "manager_id") : null;
      }
      if (patch.fund_id !== undefined) {
        biz.fund_id = patch.fund_id ? toObjectId(patch.fund_id, "fund_id") : null;
      }
      biz.version += 1;
      await biz.save({ session });

      await writeAudit(
        {
          organization_id: org_id,
          actor_id,
          actor_role: null,
          action: "business.update",
          entity_type: "business",
          entity_id: biz._id,
          before,
          after: { name: biz.name, kind: biz.kind, status: biz.status, community_id: biz.community_id?.toString() ?? null },
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

export async function approveBusiness(
  actor: Actor,
  id: string,
  ctx: RequestCtx
): Promise<void> {
  if (!can(actor, "businesses.approve")) throw new AppError("forbidden", "forbidden");
  const org_id = toObjectId(actor.organization_id, "organization_id");
  const actor_id = toObjectId(actor.user_id, "actor");
  const biz_id = toObjectId(id, "business_id");

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const biz = await Business.findOne({ _id: biz_id, organization_id: org_id }).session(session);
      if (!biz) throw new AppError("not_found", "business not found");
      if (biz.public_visibility === "public") throw new AppError("conflict", "already public");

      biz.public_visibility = "public";
      biz.approved_at = new Date();
      biz.approved_by = actor_id;
      biz.version += 1;
      await biz.save({ session });

      await writeAudit(
        {
          organization_id: org_id,
          actor_id,
          actor_role: null,
          action: "business.approve",
          entity_type: "business",
          entity_id: biz._id,
          after: { public_visibility: "public" },
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

export async function retireBusiness(
  actor: Actor,
  id: string,
  ctx: RequestCtx
): Promise<void> {
  if (!can(actor, "businesses.retire")) throw new AppError("forbidden", "forbidden");
  const org_id = toObjectId(actor.organization_id, "organization_id");
  const actor_id = toObjectId(actor.user_id, "actor");
  const biz_id = toObjectId(id, "business_id");

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const biz = await Business.findOne({ _id: biz_id, organization_id: org_id }).session(session);
      if (!biz) throw new AppError("not_found", "business not found");
      if (biz.status === "retired") throw new AppError("conflict", "already retired");

      const before = { status: biz.status };
      biz.status = "retired";
      biz.retired_on = new Date();
      biz.version += 1;
      await biz.save({ session });

      await writeAudit(
        {
          organization_id: org_id,
          actor_id,
          actor_role: null,
          action: "business.retire",
          entity_type: "business",
          entity_id: biz._id,
          before,
          after: { status: "retired" },
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

export async function listBusinesses(
  actor: Actor,
  opts: { after?: string | null; limit?: number; community_id?: string | null } = {}
): Promise<{ items: Array<Record<string, unknown>>; next: string | null }> {
  if (!can(actor, "businesses.read")) throw new AppError("forbidden", "forbidden");
  const org_id = toObjectId(actor.organization_id, "organization_id");
  const limit = Math.min(100, opts.limit ?? 25);
  const q: Record<string, unknown> = { organization_id: org_id };
  if (opts.community_id) {
    q.community_id = toObjectId(opts.community_id, "community_id");
  }
  if (opts.after && mongoose.isValidObjectId(opts.after)) {
    q._id = { $gt: new mongoose.Types.ObjectId(opts.after) };
  }
  const rows = await Business.find(q).sort({ _id: 1 }).limit(limit).lean();
  return {
    items: rows.map((b) => ({
      id: b._id.toString(),
      slug: b.slug,
      name: b.name,
      kind: b.kind,
      status: b.status,
      summary: b.summary,
      community_id: b.community_id ? b.community_id.toString() : null,
      manager_id: b.manager_id ? b.manager_id.toString() : null,
      fund_id: b.fund_id ? b.fund_id.toString() : null,
      public_visibility: b.public_visibility,
      approved_at: b.approved_at,
      retired_on: b.retired_on,
      version: b.version,
    })),
    next: rows.length === limit && rows.length > 0 ? rows[rows.length - 1]!._id.toString() : null,
  };
}
