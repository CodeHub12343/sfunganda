import { env } from "@/config/env.js";
import { AppError } from "@/util/errors.js";
import { log } from "@/util/log.js";

// Donations checkout — moved out of the Next.js API into the Express service.
// Returns a Stripe-hosted session URL. Idempotency key stashing comes in
// Phase 4 along with persisted donation rows; for Phase 1 this is a thin
// wrapper that keeps the hardened Phase 0 validation.

const MIN_CENTS = 100;
const MAX_CENTS = 100_000_000;

export type CheckoutInput = {
  amount: unknown;
  monthly: unknown;
  project_slug?: string;
  donor_name?: string;
  donor_email?: string;
  anonymous?: boolean;
};

export type CheckoutResult = { url: string };

function parseAmountToCents(input: unknown): number | null {
  const n = typeof input === "string" ? Number(input) : Number(input);
  if (!Number.isFinite(n)) return null;
  const cents = Math.round(n * 100);
  if (cents < MIN_CENTS || cents > MAX_CENTS) return null;
  return cents;
}

export async function createCheckoutSession(input: CheckoutInput): Promise<CheckoutResult> {
  if (!env.STRIPE_SECRET_KEY) throw new AppError("unavailable", "donations are not configured");
  const unitAmount = parseAmountToCents(input.amount);
  if (unitAmount === null) throw new AppError("bad_request", "please choose a valid amount");
  const monthly = Boolean(input.monthly);

  const origin = env.PUBLIC_SITE_URL.replace(/\/$/, "");
  const params = new URLSearchParams();
  params.set("mode", monthly ? "subscription" : "payment");
  params.set("success_url", `${origin}/?donation=success#sponsor`);
  params.set("cancel_url", `${origin}/?donation=cancelled#sponsor`);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", "usd");
  params.set("line_items[0][price_data][unit_amount]", String(unitAmount));
  params.set(
    "line_items[0][price_data][product_data][name]",
    monthly ? "Monthly donation — Sarah's Foundation" : "Donation — Sarah's Foundation"
  );
  if (monthly) params.set("line_items[0][price_data][recurring][interval]", "month");
  else params.set("submit_type", "donate");

  // Pass-through metadata — read by the webhook to designate the project
  // and author attribution.
  if (input.project_slug) params.set("metadata[project_slug]", input.project_slug);
  if (input.donor_name) params.set("metadata[donor_name]", input.donor_name.slice(0, 160));
  if (input.anonymous) params.set("metadata[anonymous]", "true");
  if (input.donor_email) params.set("customer_email", input.donor_email);
  // Mirror into payment_intent metadata so a payment_intent.succeeded event
  // (which doesn't carry Checkout metadata) still finds the project.
  if (input.project_slug)
    params.set("payment_intent_data[metadata][project_slug]", input.project_slug);

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const data = (await res.json().catch(() => ({}))) as {
    url?: string;
    error?: { type?: string; message?: string };
  };
  if (!res.ok || !data.url) {
    log.error({ status: res.status, type: data.error?.type ?? "unknown" }, "stripe.create_session.failed");
    throw new AppError("unavailable", "could not start checkout");
  }
  return { url: data.url };
}
