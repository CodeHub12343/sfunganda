import { NextResponse } from "next/server";

// =============================================================================
// POST /api/volunteer
// Receives a volunteer signup, validates it server-side, screens for spam, then
// forwards it to the configured sink(s). MVP supports two optional, env-driven
// sinks — set either/both in .env.local:
//   • VOLUNTEER_WEBHOOK_URL  — e.g. a Google Apps Script / Zapier / Make webhook
//                              that appends a row to a Sheet (recommended start)
//   • RESEND_API_KEY + VOLUNTEER_NOTIFY_TO (+ VOLUNTEER_NOTIFY_FROM)
//                              — emails the team each new signup
// If neither is configured, the signup is logged server-side so nothing is lost
// while the team wires up credentials.
// =============================================================================

export const runtime = "nodejs";

const TASKS = [
  "social-media",
  "text-marketing",
  "email-marketing",
  "flyer-distribution",
  "wherever-needed",
] as const;
type Task = (typeof TASKS)[number];

type Address = {
  line1: string;
  line2?: string;
  city: string;
  stateProvince?: string;
  postalCode: string;
  country: string;
};

type Payload = {
  fullName: string;
  email: string;
  phone?: string;
  country: string;
  cityRegion: string;
  tasks: Task[];
  address?: Address;
  note?: string;
  consent: boolean;
  website?: string; // honeypot
  source?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(b: Partial<Payload>): { ok: true; data: Payload } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const tasks = Array.isArray(b.tasks) ? b.tasks.filter((t): t is Task => TASKS.includes(t as Task)) : [];

  if (!b.fullName?.trim()) errors.push("fullName is required");
  if (!b.email || !EMAIL_RE.test(b.email)) errors.push("a valid email is required");
  if (!b.country?.trim()) errors.push("country is required");
  if (!b.cityRegion?.trim()) errors.push("cityRegion is required");
  if (tasks.length === 0) errors.push("at least one task is required");
  if (b.consent !== true) errors.push("consent is required");

  if (tasks.includes("text-marketing") && !b.phone?.trim())
    errors.push("phone is required for text-marketing");

  if (tasks.includes("flyer-distribution")) {
    const a = b.address;
    if (!a?.line1?.trim() || !a?.city?.trim() || !a?.postalCode?.trim())
      errors.push("a mailing address is required for flyer-distribution");
  }

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    data: {
      fullName: b.fullName!.trim(),
      email: b.email!.trim(),
      phone: b.phone?.trim() || undefined,
      country: b.country!.trim(),
      cityRegion: b.cityRegion!.trim(),
      tasks,
      address: tasks.includes("flyer-distribution") ? b.address : undefined,
      note: b.note?.trim() || undefined,
      consent: true,
      source: b.source || "website",
    },
  };
}

async function forwardToWebhook(record: Record<string, unknown>) {
  const url = process.env.VOLUNTEER_WEBHOOK_URL;
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });
}

async function notifyByEmail(data: Payload) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.VOLUNTEER_NOTIFY_TO;
  const from = process.env.VOLUNTEER_NOTIFY_FROM || "Sarah's Foundation <onboarding@resend.dev>";
  if (!apiKey || !to) return;

  const addr = data.address
    ? `${data.address.line1}${data.address.line2 ? ", " + data.address.line2 : ""}, ${data.address.city}, ${data.address.stateProvince ?? ""} ${data.address.postalCode}, ${data.address.country}`
    : "—";

  const text = [
    `New volunteer: ${data.fullName}`,
    `Email: ${data.email}`,
    `Phone: ${data.phone ?? "—"}`,
    `Location: ${data.cityRegion}, ${data.country}`,
    `Tasks: ${data.tasks.join(", ")}`,
    `Mailing address: ${addr}`,
    `Note: ${data.note ?? "—"}`,
  ].join("\n");

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: `🙋 New volunteer: ${data.fullName} (${data.country})`,
      text,
    }),
  });
}

export async function POST(req: Request) {
  let body: Partial<Payload>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  // Honeypot — bots fill the hidden "website" field. Pretend success.
  if (body.website && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const result = validate(body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, errors: result.errors }, { status: 400 });
  }

  const record = { ...result.data, submittedAt: new Date().toISOString() };

  try {
    const sinks = await Promise.allSettled([
      forwardToWebhook(record),
      notifyByEmail(result.data),
    ]);

    const allFailed = sinks.every((s) => s.status === "rejected");
    const noneConfigured =
      !process.env.VOLUNTEER_WEBHOOK_URL &&
      !(process.env.RESEND_API_KEY && process.env.VOLUNTEER_NOTIFY_TO);

    if (noneConfigured) {
      // Nothing wired up yet — don't drop the signup silently.
      console.log("[volunteer] new signup (no sink configured):", record);
    } else if (allFailed) {
      console.error("[volunteer] all sinks failed for:", record.email);
      return NextResponse.json(
        { ok: false, error: "Could not save signup. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[volunteer] unexpected error:", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
