import { NextResponse } from "next/server";

// =============================================================================
// POST /api/checkout
// Creates a Stripe Checkout Session for a donation and returns its hosted URL.
// Supports one-time gifts (mode=payment) and monthly giving (mode=subscription)
// with a donor-chosen amount via inline price_data — no preconfigured prices.
//
// We call Stripe's REST API directly so the project needs no SDK dependency.
// Required env (set in .env.local / hosting env):
//   • STRIPE_SECRET_KEY      — sk_live_… or sk_test_…
// Optional:
//   • NEXT_PUBLIC_SITE_URL   — canonical origin for success/cancel redirects
//                              (falls back to the request's Origin header)
// =============================================================================

export const runtime = "nodejs";

type Body = { amount?: number; monthly?: boolean };

const MIN_USD = 1;
const MAX_USD = 1_000_000;

function resolveOrigin(req: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const origin = req.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");
  return new URL(req.url).origin;
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json(
      { error: "Donations aren't configured yet. Please try again soon." },
      { status: 503 }
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const dollars = Math.round(Number(body.amount));
  if (!Number.isFinite(dollars) || dollars < MIN_USD || dollars > MAX_USD) {
    return NextResponse.json({ error: "Please choose a valid amount." }, { status: 400 });
  }
  const monthly = Boolean(body.monthly);
  const unitAmount = dollars * 100; // cents
  const origin = resolveOrigin(req);

  // Build the form-encoded Checkout Session params.
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
  if (monthly) {
    params.set("line_items[0][price_data][recurring][interval]", "month");
  } else {
    // "Donate" CTA + lets donors opt to cover fees on the hosted page.
    params.set("submit_type", "donate");
  }

  try {
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = (await res.json()) as { url?: string; error?: { message?: string } };
    if (!res.ok || !data.url) {
      console.error("[checkout] Stripe error:", data.error?.message ?? res.statusText);
      return NextResponse.json(
        { error: "Could not start checkout. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: data.url });
  } catch (err) {
    console.error("[checkout] unexpected error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
