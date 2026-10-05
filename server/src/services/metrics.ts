import mongoose from "mongoose";
import { MetricDefinition, MetricEntry } from "@/models/index.js";
import type { MetricDefinitionDoc, MetricAggregate } from "@/models/MetricDefinition.js";
import { AppError } from "@/util/errors.js";
import { can, type Actor } from "@/policy/index.js";

export async function listDefinitions(
  actor: Actor,
  { publicOnly }: { publicOnly?: boolean } = {}
): Promise<MetricDefinitionDoc[]> {
  if (!publicOnly && !can(actor, "metrics.read"))
    throw new AppError("forbidden", "cannot list metrics");
  const q: Record<string, unknown> = {
    organization_id: new mongoose.Types.ObjectId(actor.organization_id),
    retired_at: null,
  };
  if (publicOnly) q.public = true;
  return MetricDefinition.find(q).sort({ label: 1 }).lean<MetricDefinitionDoc[]>();
}

export async function createDefinition(
  actor: Actor,
  input: {
    key: string;
    label: string;
    unit: string;
    description?: string;
    aggregate?: MetricAggregate;
    public?: boolean;
  }
): Promise<MetricDefinitionDoc> {
  if (!can(actor, "metrics.write_definition"))
    throw new AppError("forbidden", "cannot create metric definitions");
  try {
    const doc = await MetricDefinition.create({
      organization_id: new mongoose.Types.ObjectId(actor.organization_id),
      key: input.key.toLowerCase(),
      label: input.label,
      unit: input.unit,
      description: input.description ?? "",
      aggregate: input.aggregate ?? "sum",
      public: input.public ?? false,
    });
    return doc.toObject();
  } catch (err) {
    if ((err as { code?: number }).code === 11000)
      throw new AppError("conflict", "a metric with that key already exists", {
        fields: { key: "already in use" },
      });
    throw err;
  }
}

export async function retire(actor: Actor, id: string): Promise<void> {
  if (!can(actor, "metrics.write_definition")) throw new AppError("forbidden", "cannot retire");
  await MetricDefinition.updateOne(
    {
      _id: new mongoose.Types.ObjectId(id),
      organization_id: new mongoose.Types.ObjectId(actor.organization_id),
    },
    { $set: { retired_at: new Date() } }
  );
}

export type AggregatedMetric = {
  key: string;
  label: string;
  unit: string;
  aggregate: MetricAggregate;
  value: number;
};

export async function aggregatePublic(
  organization_id: string
): Promise<AggregatedMetric[]> {
  const orgId = new mongoose.Types.ObjectId(organization_id);
  const defs = await MetricDefinition.find({
    organization_id: orgId,
    public: true,
    retired_at: null,
  }).lean<MetricDefinitionDoc[]>();

  const results: AggregatedMetric[] = [];
  for (const def of defs) {
    const op =
      def.aggregate === "sum"
        ? { $sum: "$value" }
        : def.aggregate === "avg"
          ? { $avg: "$value" }
          : def.aggregate === "max"
            ? { $max: "$value" }
            : { $last: "$value" };
    const rows = await MetricEntry.aggregate([
      { $match: { organization_id: orgId, definition_id: def._id } },
      { $sort: { occurred_on: 1 } },
      { $group: { _id: null, value: op } },
    ]);
    const value = Number(rows[0]?.value ?? 0);
    results.push({
      key: def.key,
      label: def.label,
      unit: def.unit,
      aggregate: def.aggregate,
      value,
    });
  }
  return results;
}
