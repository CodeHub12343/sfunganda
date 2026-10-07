import { connectDB, disconnectDB } from "@/config/db.js";
import { log } from "@/util/log.js";
import {
  Community,
  ExpenseCategory,
  Fund,
  MetricDefinition,
  Organization,
  ProjectCategory,
} from "@/models/index.js";

// =============================================================================
// Production seed. Idempotent. Lays down the reference data every running
// deployment expects: default project categories, metric definitions, the
// general fund, and the expense category tree. Users, communities, and
// projects are intentionally LEFT ALONE — those come from the operator.
//
// Run after `npm run migrate && npm run seed` (which creates the organisation
// and founder user). Safe to re-run on every deploy.
// =============================================================================

async function upsertOne<T extends { organization_id: unknown }>(
  model: {
    findOne: (q: unknown) => { lean: () => Promise<T | null> };
    create: (d: unknown) => Promise<unknown>;
  },
  query: Record<string, unknown>,
  defaults: Record<string, unknown>
): Promise<"created" | "existed"> {
  const existing = await model.findOne(query).lean();
  if (existing) return "existed";
  await model.create({ ...query, ...defaults });
  return "created";
}

const PROJECT_CATEGORIES = [
  { slug: "water-sanitation", name: "Water & sanitation", color: "#0ea5e9" },
  { slug: "education", name: "Education", color: "#8b5cf6" },
  { slug: "food-security", name: "Food security", color: "#f59e0b" },
  { slug: "health", name: "Health", color: "#ef4444" },
  { slug: "livelihoods", name: "Livelihoods", color: "#10b981" },
  { slug: "emergency-relief", name: "Emergency relief", color: "#f97316" },
];

const EXPENSE_CATEGORIES = [
  { slug: "materials", name: "Materials & supplies" },
  { slug: "transport", name: "Transport & logistics" },
  { slug: "stipends", name: "Field stipends" },
  { slug: "training", name: "Training & workshops" },
  { slug: "equipment", name: "Equipment" },
  { slug: "admin", name: "Administration" },
  { slug: "communications", name: "Communications & printing" },
  { slug: "fees-bank", name: "Bank fees" },
  { slug: "other", name: "Other" },
];

const METRIC_DEFINITIONS = [
  { key: "beneficiaries_direct", label: "Direct beneficiaries", unit: "people", aggregate: "sum", public: true },
  { key: "households_reached", label: "Households reached", unit: "households", aggregate: "sum", public: true },
  { key: "water_sources_built", label: "Water sources built", unit: "sources", aggregate: "sum", public: true },
  { key: "students_supported", label: "Students supported", unit: "students", aggregate: "sum", public: true },
  { key: "meals_provided", label: "Meals provided", unit: "meals", aggregate: "sum", public: true },
  { key: "training_hours", label: "Training hours delivered", unit: "hours", aggregate: "sum", public: true },
];

async function main(): Promise<void> {
  await connectDB();

  const org = await Organization.findOne().sort({ _id: 1 });
  if (!org) {
    log.error("seed.production.no_org");
    process.exit(1);
  }
  const base_currency: string = (org as unknown as { base_currency?: string }).base_currency ?? "USD";
  log.info({ org: org._id.toString(), base_currency }, "seed.production.start");

  // General fund — the default landing place for unrestricted donations.
  const generalFund = await upsertOne(
    Fund as unknown as Parameters<typeof upsertOne>[0],
    { organization_id: org._id, code: "GEN" },
    {
      name: "General Fund",
      kind: "general",
      base_currency,
      balance_cents: 0,
      total_in_cents: 0,
      total_out_cents: 0,
      active: true,
    }
  );
  log.info({ fund: "GEN", status: generalFund }, "seed.production.fund");

  for (const c of PROJECT_CATEGORIES) {
    const r = await upsertOne(
      ProjectCategory as unknown as Parameters<typeof upsertOne>[0],
      { organization_id: org._id, slug: c.slug },
      { name: c.name, color: c.color, description: "" }
    );
    log.info({ category: c.slug, status: r }, "seed.production.project_category");
  }

  for (const e of EXPENSE_CATEGORIES) {
    const r = await upsertOne(
      ExpenseCategory as unknown as Parameters<typeof upsertOne>[0],
      { organization_id: org._id, slug: e.slug },
      { name: e.name, description: "", retired_at: null }
    );
    log.info({ category: e.slug, status: r }, "seed.production.expense_category");
  }

  for (const m of METRIC_DEFINITIONS) {
    const r = await upsertOne(
      MetricDefinition as unknown as Parameters<typeof upsertOne>[0],
      { organization_id: org._id, key: m.key },
      {
        label: m.label,
        unit: m.unit,
        aggregate: m.aggregate,
        public: m.public,
        description: "",
        retired_at: null,
      }
    );
    log.info({ metric: m.key, status: r }, "seed.production.metric");
  }

  // At least one community so the admin UI's "create project" picker has
  // something to show. If one already exists we leave it.
  const anyCommunity = await Community.findOne({ organization_id: org._id }).lean();
  if (!anyCommunity) {
    const comm = await Community.create({
      organization_id: org._id,
      name: "Kampala Metro",
      slug: "kampala-metro",
      region_label: "Central Region, Uganda",
      status: "active",
      summary: "Our launch community, serving neighbourhoods across the Kampala metro area.",
    });
    log.info({ community: comm._id.toString() }, "seed.production.community.created");
  }

  await disconnectDB();
  log.info("seed.production.done");
}

main().catch((err) => {
  log.error({ err: err instanceof Error ? err.message : "unknown" }, "seed.production.failed");
  process.exit(1);
});
