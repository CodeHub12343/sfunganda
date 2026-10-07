import mongoose from "mongoose";
import {
  Accomplishment,
  AccomplishmentRevision,
  ApprovalEvent,
  IdSequence,
  MetricEntry,
  Project,
} from "@/models/index.js";
import type {
  AccomplishmentDoc,
  AccomplishmentState,
  AccomplishmentMetricEntry,
} from "@/models/Accomplishment.js";
import type { ApprovalEventKind } from "@/models/ApprovalEvent.js";
import { AppError } from "@/util/errors.js";
import { can, type Actor } from "@/policy/index.js";
import { enqueue } from "./outbox.js";

// ============================================================================
// Accomplishment state machine (§15.3). All transitions go through
// `transition()`, which:
//   1. Loads with optimistic-concurrency version check.
//   2. Validates the proposed transition is in the allowed set.
//   3. Enforces separation-of-duties invariants.
//   4. Writes a revision snapshot + an approval event in one Mongo txn.
//   5. Emits an outbox event (notifications, cache revalidation).
// ============================================================================

type Transition = {
  from: AccomplishmentState[];
  to: AccomplishmentState;
  kind: ApprovalEventKind;
  // Minimal policy action the actor must hold.
  action:
    | "accomplishments.author"
    | "accomplishments.review"
    | "accomplishments.approve"
    | "accomplishments.publish"
    | "accomplishments.archive";
};

const TRANSITIONS: Record<string, Transition> = {
  submit: {
    from: ["draft", "changes_requested"],
    to: "submitted",
    kind: "submit",
    action: "accomplishments.author",
  },
  withdraw: {
    from: ["submitted", "in_review"],
    to: "draft",
    kind: "withdraw",
    action: "accomplishments.author",
  },
  claim_review: {
    from: ["submitted"],
    to: "in_review",
    kind: "claim_review",
    action: "accomplishments.review",
  },
  request_changes: {
    from: ["in_review"],
    to: "changes_requested",
    kind: "request_changes",
    action: "accomplishments.review",
  },
  reject: {
    from: ["in_review"],
    to: "rejected",
    kind: "reject",
    action: "accomplishments.approve",
  },
  approve: {
    from: ["in_review"],
    to: "approved",
    kind: "approve",
    action: "accomplishments.approve",
  },
  publish: {
    from: ["approved"],
    to: "published",
    kind: "publish",
    action: "accomplishments.publish",
  },
  archive: {
    from: ["published", "rejected"],
    to: "archived",
    kind: "archive",
    action: "accomplishments.archive",
  },
};

export const TRANSITION_NAMES = Object.keys(TRANSITIONS);

export type AccomplishmentInput = {
  project_id: string;
  milestone_id?: string;
  title: string;
  summary: string;
  body_markdown: string;
  occurred_on: string;
  beneficiary_count?: number;
  location_label?: string;
  media_asset_ids?: string[];
  metrics?: Array<{ definition_id: string; value: number; unit?: string }>;
};

export async function createDraft(
  actor: Actor,
  input: AccomplishmentInput
): Promise<AccomplishmentDoc> {
  if (!can(actor, "accomplishments.author"))
    throw new AppError("forbidden", "cannot author accomplishments");

  const orgId = new mongoose.Types.ObjectId(actor.organization_id);
  const project = await Project.findOne({ _id: input.project_id, organization_id: orgId }).lean();
  if (!project) throw new AppError("not_found", "project not found");

  const doc = await Accomplishment.create({
    organization_id: orgId,
    project_id: new mongoose.Types.ObjectId(input.project_id),
    milestone_id: input.milestone_id ? new mongoose.Types.ObjectId(input.milestone_id) : null,
    title: input.title,
    summary: input.summary,
    body_markdown: input.body_markdown,
    occurred_on: new Date(input.occurred_on),
    beneficiary_count: input.beneficiary_count ?? null,
    location_label: input.location_label ?? null,
    media_asset_ids: (input.media_asset_ids ?? []).map((id) => new mongoose.Types.ObjectId(id)),
    metrics: (input.metrics ?? []).map((m) => ({
      definition_id: new mongoose.Types.ObjectId(m.definition_id),
      value: m.value,
      unit: m.unit ?? null,
    })),
    created_by: new mongoose.Types.ObjectId(actor.user_id),
    state: "draft",
  });
  return doc.toObject();
}

export async function updateDraft(
  actor: Actor,
  id: string,
  patch: Partial<AccomplishmentInput> & { version: number }
): Promise<AccomplishmentDoc> {
  if (!can(actor, "accomplishments.author"))
    throw new AppError("forbidden", "cannot edit accomplishments");

  const orgId = new mongoose.Types.ObjectId(actor.organization_id);
  const current = await Accomplishment.findOne({
    _id: new mongoose.Types.ObjectId(id),
    organization_id: orgId,
  });
  if (!current) throw new AppError("not_found", "accomplishment not found");
  // Only author of a draft/changes_requested may edit; reviewers set state.
  if (!["draft", "changes_requested"].includes(current.state))
    throw new AppError("conflict", "accomplishment is locked for editing");
  if (current.created_by.toString() !== actor.user_id)
    throw new AppError("forbidden", "only the author may edit this draft");
  if (current.version !== patch.version)
    throw new AppError("version_conflict", "it has changed since you loaded it");

  if (patch.title !== undefined) current.title = patch.title;
  if (patch.summary !== undefined) current.summary = patch.summary;
  if (patch.body_markdown !== undefined) current.body_markdown = patch.body_markdown;
  if (patch.occurred_on !== undefined) current.occurred_on = new Date(patch.occurred_on);
  if (patch.beneficiary_count !== undefined) current.beneficiary_count = patch.beneficiary_count;
  if (patch.location_label !== undefined) current.location_label = patch.location_label ?? null;
  if (patch.media_asset_ids !== undefined)
    current.media_asset_ids = patch.media_asset_ids.map((x) => new mongoose.Types.ObjectId(x));
  if (patch.metrics !== undefined)
    current.metrics = patch.metrics.map(
      (m): AccomplishmentMetricEntry => ({
        definition_id: new mongoose.Types.ObjectId(m.definition_id),
        value: m.value,
        unit: m.unit ?? null,
      })
    );
  if (patch.milestone_id !== undefined)
    current.milestone_id = patch.milestone_id
      ? new mongoose.Types.ObjectId(patch.milestone_id)
      : null;
  current.version += 1;
  await current.save();
  return current.toObject();
}

async function snapshot(doc: AccomplishmentDoc): Promise<AccomplishmentRevisionDoc["snapshot"]> {
  return {
    title: doc.title,
    summary: doc.summary,
    body_markdown: doc.body_markdown,
    occurred_on: doc.occurred_on,
    beneficiary_count: doc.beneficiary_count,
    location_label: doc.location_label,
    media_asset_ids: doc.media_asset_ids.map((x) => x.toString()),
    metrics: doc.metrics.map((m) => ({
      definition_id: m.definition_id.toString(),
      value: m.value,
      unit: m.unit,
    })),
  };
}

type AccomplishmentRevisionDoc = import("@/models/AccomplishmentRevision.js").AccomplishmentRevisionDoc;

export type TransitionInput = {
  transition: keyof typeof TRANSITIONS;
  version: number;
  note?: string;
  safeguarding?: Record<string, boolean>;
  // §17.2 step 6 — approvers of an ai_assisted item must tick "I have
  // checked this against the field report". The service refuses the
  // transition without it. Stored on the accomplishment so later audits
  // can prove the check was done.
  ai_attestation?: boolean;
};

export async function transition(
  actor: Actor,
  id: string,
  input: TransitionInput
): Promise<AccomplishmentDoc> {
  const t = TRANSITIONS[input.transition];
  if (!t) throw new AppError("bad_request", "unknown transition");
  if (!can(actor, t.action)) throw new AppError("forbidden", "cannot perform that transition");

  const orgId = new mongoose.Types.ObjectId(actor.organization_id);
  const session = await mongoose.startSession();
  try {
    const result = await session.withTransaction(async () => {
      const doc = await Accomplishment.findOne({
        _id: new mongoose.Types.ObjectId(id),
        organization_id: orgId,
      }).session(session);
      if (!doc) throw new AppError("not_found", "accomplishment not found");
      if (!t.from.includes(doc.state))
        throw new AppError("conflict", `cannot ${input.transition} from ${doc.state}`);
      if (doc.version !== input.version)
        throw new AppError("version_conflict", "it has changed since you loaded it");

      enforceSeparationOfDuties(input.transition, doc, actor);

      if (input.transition === "approve") {
        requireSafeguarding(input.safeguarding);
      }

      const from = doc.state;
      doc.state = t.to;
      doc.version += 1;

      // Stamp per-transition fields.
      const now = new Date();
      const uid = new mongoose.Types.ObjectId(actor.user_id);

      // §17 attestation gate — the APPROVAL step (not publish) is where
      // the reviewer confirms facts against the field report, because
      // approve is where the content is actually scrutinised. We also
      // guard publish defensively.
      if (
        (input.transition === "approve" || input.transition === "publish") &&
        doc.ai_assisted
      ) {
        const alreadyAttested = Boolean(doc.ai_attestation_at);
        if (!input.ai_attestation && !alreadyAttested) {
          throw new AppError(
            "unprocessable",
            "AI-assisted content requires an attestation",
            { fields: { ai_attestation: "must be acknowledged" } }
          );
        }
        if (input.ai_attestation && !alreadyAttested) {
          doc.ai_attestation_by = uid;
          doc.ai_attestation_at = now;
        }
      }
      if (input.transition === "submit") {
        doc.submitted_by = uid;
        doc.submitted_at = now;
      }
      if (input.transition === "claim_review") {
        doc.reviewer_id = uid;
        doc.review_started_at = now;
      }
      if (input.transition === "request_changes") {
        // Return to the author; reviewer stays assigned so they see it return.
      }
      if (input.transition === "withdraw") {
        doc.reviewer_id = null;
        doc.review_started_at = null;
      }
      if (input.transition === "reject") {
        doc.rejected_at = now;
      }
      if (input.transition === "approve") {
        doc.approved_by = uid;
        doc.approved_at = now;
      }
      if (input.transition === "publish") {
        doc.published_by = uid;
        doc.published_at = now;
        if (!doc.public_id) {
          doc.public_id = await allocatePublicId(orgId, now.getUTCFullYear(), session);
        }
        // Project snapshot — part of the publish transaction (§15.3).
        await Project.updateOne(
          { _id: doc.project_id, organization_id: orgId },
          {
            $set: { last_published_at: now },
            $inc: { published_accomplishment_count: 1 },
          },
          { session }
        );
        // Materialize metric entries for aggregation.
        if (doc.metrics.length > 0) {
          await MetricEntry.insertMany(
            doc.metrics.map((m) => ({
              organization_id: orgId,
              definition_id: m.definition_id,
              project_id: doc.project_id,
              accomplishment_id: doc._id,
              value: m.value,
              unit: m.unit,
              occurred_on: doc.occurred_on,
              recorded_by: uid,
            })),
            { session, ordered: true }
          );
        }
      }

      await doc.save({ session });

      await AccomplishmentRevision.create(
        [
          {
            organization_id: orgId,
            accomplishment_id: doc._id,
            version: doc.version,
            state_before: from,
            state_after: doc.state,
            snapshot: await snapshot(doc.toObject()),
            by_user_id: uid,
            note: input.note ?? null,
          },
        ],
        { session }
      );
      await ApprovalEvent.create(
        [
          {
            organization_id: orgId,
            accomplishment_id: doc._id,
            kind: t.kind,
            by_user_id: uid,
            by_role: actor.assignments[0]?.role ?? null,
            note: input.note ?? null,
            safeguarding: input.safeguarding ?? null,
            from_state: from,
            to_state: doc.state,
            version_at: doc.version,
          },
        ],
        { session }
      );

      // Fire outbox events: cache revalidation on publish, staff notification
      // on submit / request_changes.
      if (input.transition === "publish") {
        await enqueue(
          {
            organization_id: orgId,
            topic: "cache.revalidate",
            payload: {
              tags: [
                "public:accomplishments",
                `public:accomplishment:${doc.public_id}`,
                `public:project:${doc.project_id.toString()}`,
                "public:impact",
                "public:home",
              ],
            },
          },
          session
        );
        // Phase 7 — fan-out to followers of the project.
        await enqueue(
          {
            organization_id: orgId,
            topic: "notification.fanout_accomplishment_published",
            payload: { accomplishment_id: doc._id.toString() },
          },
          session
        );
        // Phase 12 — social cross-post fan-out. One event (one handler
        // tick) that creates per-connection rows; each row is then
        // posted independently through `social.post`. Failures NEVER
        // roll back this publish (§14.7).
        await enqueue(
          {
            organization_id: orgId,
            topic: "social.fanout_accomplishment_published",
            payload: { accomplishment_id: doc._id.toString() },
          },
          session
        );
      }
      if (input.transition === "submit") {
        await enqueue(
          {
            organization_id: orgId,
            topic: "notify.review_queue",
            payload: { accomplishment_id: doc._id.toString(), title: doc.title },
          },
          session
        );
      }
      if (input.transition === "request_changes") {
        await enqueue(
          {
            organization_id: orgId,
            topic: "notify.author_revision",
            payload: {
              accomplishment_id: doc._id.toString(),
              author_id: doc.created_by.toString(),
              note: input.note ?? "",
            },
          },
          session
        );
      }

      return doc.toObject();
    });
    if (!result) throw new AppError("internal_error", "transaction returned no result");
    return result;
  } finally {
    await session.endSession();
  }
}

function enforceSeparationOfDuties(
  name: keyof typeof TRANSITIONS,
  doc: { created_by: mongoose.Types.ObjectId; approved_by: mongoose.Types.ObjectId | null; reviewer_id: mongoose.Types.ObjectId | null },
  actor: Actor
): void {
  // C2 — the author of an accomplishment cannot be its approver, publisher,
  // or (after submission) its reviewer.
  if (name === "approve" || name === "publish" || name === "claim_review" || name === "request_changes" || name === "reject") {
    if (doc.created_by.toString() === actor.user_id) {
      throw new AppError("forbidden", "the author cannot act as reviewer, approver, or publisher");
    }
  }
  // The approver cannot also publish — a second person must hand the output
  // to the public. Founders may override by holding both roles only when the
  // org has one director (operator policy); we keep the rule strict here.
  if (name === "publish") {
    if (doc.approved_by && doc.approved_by.toString() === actor.user_id) {
      throw new AppError("forbidden", "the approver cannot also publish");
    }
  }
}

function requireSafeguarding(sg: Record<string, boolean> | undefined): void {
  const required = [
    "consent_recorded",
    "no_minor_identifiers",
    "images_appropriate",
    "names_scrubbed",
  ];
  if (!sg) throw new AppError("unprocessable", "safeguarding checklist required", { fields: { safeguarding: "required" } });
  const missing = required.filter((k) => sg[k] !== true);
  if (missing.length > 0) {
    const fields: Record<string, string> = {};
    for (const k of missing) fields[`safeguarding.${k}`] = "must be acknowledged";
    throw new AppError("unprocessable", "safeguarding checklist incomplete", { fields });
  }
}

async function allocatePublicId(
  organization_id: mongoose.Types.ObjectId,
  year: number,
  session: mongoose.ClientSession
): Promise<string> {
  const seq = await IdSequence.findOneAndUpdate(
    { organization_id, kind: "accomplishment", year },
    { $inc: { next_value: 1 }, $setOnInsert: { organization_id, kind: "accomplishment", year } },
    { upsert: true, new: true, session }
  );
  const n = (seq.next_value - 1).toString().padStart(4, "0");
  return `ACC-${year}-${n}`;
}

export async function listAccomplishments(
  actor: Actor,
  opts: {
    project_id?: string;
    state?: AccomplishmentState;
    mine?: boolean;
    cursor?: string;
    limit?: number;
  }
): Promise<{ items: AccomplishmentDoc[]; next_cursor: string | null }> {
  if (!can(actor, "accomplishments.read"))
    throw new AppError("forbidden", "cannot list accomplishments");
  const q: Record<string, unknown> = {
    organization_id: new mongoose.Types.ObjectId(actor.organization_id),
  };
  if (opts.project_id) q.project_id = new mongoose.Types.ObjectId(opts.project_id);
  if (opts.state) q.state = opts.state;
  if (opts.mine) q.created_by = new mongoose.Types.ObjectId(actor.user_id);
  if (opts.cursor) q._id = { $lt: new mongoose.Types.ObjectId(opts.cursor) };
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
  const items = await Accomplishment.find(q)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean<AccomplishmentDoc[]>();
  const next_cursor = items.length > limit ? items[limit - 1]!._id.toString() : null;
  return { items: items.slice(0, limit), next_cursor };
}

export async function getAccomplishment(
  actor: Actor,
  id: string
): Promise<{ doc: AccomplishmentDoc; history: unknown[] }> {
  if (!can(actor, "accomplishments.read"))
    throw new AppError("forbidden", "cannot read accomplishment");
  const orgId = new mongoose.Types.ObjectId(actor.organization_id);
  const doc = await Accomplishment.findOne({
    _id: new mongoose.Types.ObjectId(id),
    organization_id: orgId,
  }).lean<AccomplishmentDoc>();
  if (!doc) throw new AppError("not_found", "not found");
  const history = await ApprovalEvent.find({ accomplishment_id: doc._id })
    .sort({ created_at: 1 })
    .lean();
  return { doc, history };
}

export async function getRevisions(actor: Actor, id: string): Promise<unknown[]> {
  if (!can(actor, "accomplishments.read"))
    throw new AppError("forbidden", "cannot read revisions");
  return AccomplishmentRevision.find({
    accomplishment_id: new mongoose.Types.ObjectId(id),
    organization_id: new mongoose.Types.ObjectId(actor.organization_id),
  })
    .sort({ version: -1 })
    .lean();
}

