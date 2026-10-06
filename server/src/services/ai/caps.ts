import mongoose from "mongoose";
import { AiGeneration } from "@/models/AiGeneration.js";
import { env } from "@/config/env.js";
import { AppError } from "@/util/errors.js";

// =============================================================================
// Per-user / per-org daily caps (§17.3). The limit is counted against today's
// successful + rate_limited generation rows in the ai_generations collection.
// Timezone is UTC — we don't try to align with Kampala day boundaries, the
// cap exists to limit cost and bluntness is fine.
// =============================================================================

function startOfUtcDay(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export type CapUsage = {
  user_today: number;
  org_today: number;
  org_credits_today: number;
  user_cap: number;
  org_cap: number;
  org_credits_cap: number;
  user_remaining: number;
  org_remaining: number;
  org_credits_remaining: number;
};

export async function readCapUsage(
  organization_id: mongoose.Types.ObjectId,
  user_id: mongoose.Types.ObjectId
): Promise<CapUsage> {
  const start = startOfUtcDay();
  const [userAgg] = await AiGeneration.aggregate([
    { $match: { organization_id, actor_id: user_id, created_at: { $gte: start } } },
    { $group: { _id: null, n: { $sum: 1 }, credits: { $sum: { $add: ["$tokens.input", "$tokens.output"] } } } },
  ]);
  const [orgAgg] = await AiGeneration.aggregate([
    { $match: { organization_id, created_at: { $gte: start } } },
    { $group: { _id: null, n: { $sum: 1 }, credits: { $sum: { $add: ["$tokens.input", "$tokens.output"] } } } },
  ]);
  const user_today = Number(userAgg?.n ?? 0);
  const org_today = Number(orgAgg?.n ?? 0);
  // A credit is approx. tokens / 100 — stay in integers.
  const org_credits_today = Math.ceil(Number(orgAgg?.credits ?? 0) / 100);
  return {
    user_today,
    org_today,
    org_credits_today,
    user_cap: env.AI_DAILY_USER_CAP,
    org_cap: env.AI_DAILY_ORG_CAP,
    org_credits_cap: env.AI_DAILY_ORG_CREDITS_CAP,
    user_remaining: Math.max(0, env.AI_DAILY_USER_CAP - user_today),
    org_remaining: Math.max(0, env.AI_DAILY_ORG_CAP - org_today),
    org_credits_remaining: Math.max(0, env.AI_DAILY_ORG_CREDITS_CAP - org_credits_today),
  };
}

export async function requireCapAvailable(
  organization_id: mongoose.Types.ObjectId,
  user_id: mongoose.Types.ObjectId
): Promise<CapUsage> {
  const usage = await readCapUsage(organization_id, user_id);
  if (usage.user_remaining <= 0) {
    throw new AppError("rate_limited", "you have reached today's AI drafting limit", {
      fields: { cap: "user_daily" },
    });
  }
  if (usage.org_remaining <= 0) {
    throw new AppError("rate_limited", "your organisation has reached today's AI drafting limit", {
      fields: { cap: "org_daily" },
    });
  }
  if (usage.org_credits_remaining <= 0) {
    throw new AppError("rate_limited", "your organisation has reached today's AI token budget", {
      fields: { cap: "org_credits" },
    });
  }
  return usage;
}
