import { sendMail } from "@/mail/index.js";
import { env } from "@/config/env.js";

// Templated email sender. Keeps the payload shape per template documented
// here so the fan-out code can be audited for what reaches the inbox.
//
// Returns the provider message id when the transport exposes one; our
// nodemailer wrapper doesn't surface it so we return a synthetic value.

type Template =
  | "supporter_verify"
  | "supporter_already_registered"
  | "accomplishment_published"
  | "donation_receipt";

export async function sendTemplatedEmail(input: {
  to: string;
  subject: string;
  template: string;
  payload: Record<string, unknown>;
}): Promise<string> {
  const tpl = render(input.template as Template, input.payload);
  await sendMail({ to: input.to, subject: input.subject, text: tpl.text, html: tpl.html });
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function render(template: Template, data: Record<string, unknown>): { text: string; html: string } {
  const unsub = `${env.PUBLIC_SITE_URL.replace(/\/$/, "")}/supporters/unsubscribe`;
  switch (template) {
    case "supporter_verify": {
      const name = String(data.display_name ?? "there");
      const url = String(data.verify_url ?? "");
      const hours = Number(data.expires_hours ?? 24);
      const text = [
        `Hi ${name},`,
        "",
        "Welcome to Sarah's Foundation. Please confirm your email address by opening this link:",
        url,
        "",
        `The link expires in ${hours} hours.`,
        "",
        "If you didn't sign up, you can ignore this email.",
      ].join("\n");
      const html = `<p>Hi ${esc(name)},</p>
<p>Welcome to Sarah's Foundation. Please confirm your email address:</p>
<p><a href="${esc(url)}">Confirm my email</a></p>
<p>The link expires in ${hours} hours.</p>
<p>If you didn't sign up, you can ignore this email.</p>`;
      return { text, html };
    }
    case "supporter_already_registered": {
      const name = String(data.display_name ?? "there");
      const url = String(data.sign_in_url ?? "");
      const text = [
        `Hi ${name},`,
        "",
        "Someone tried to create a Sarah's Foundation account with this email. You already have one — sign in here:",
        url,
        "",
        "If this wasn't you, no action is needed.",
      ].join("\n");
      const html = `<p>Hi ${esc(name)},</p>
<p>Someone tried to create a Sarah's Foundation account with this email. You already have one.</p>
<p><a href="${esc(url)}">Sign in</a></p>
<p>If this wasn't you, no action is needed.</p>`;
      return { text, html };
    }
    case "accomplishment_published": {
      const name = String(data.display_name ?? "there");
      const url = String(data.url ?? "");
      const title = String(data.accomplishment_title ?? "A new update");
      const project = String(data.project_name ?? "");
      const summary = String(data.summary ?? "");
      const text = [
        `Hi ${name},`,
        "",
        `${project} just posted a new update: ${title}`,
        "",
        summary,
        "",
        `Read the full report: ${url}`,
        "",
        "Thank you for following along.",
        "",
        `Unsubscribe or change your preferences: ${unsub}`,
      ].join("\n");
      const html = `<p>Hi ${esc(name)},</p>
<p><strong>${esc(project)}</strong> just posted a new update:</p>
<h2 style="margin:1rem 0">${esc(title)}</h2>
<p>${esc(summary)}</p>
<p><a href="${esc(url)}">Read the full report</a></p>
<p>Thank you for following along.</p>
<hr/>
<p style="color:#6b7280;font-size:0.85rem"><a href="${esc(unsub)}">Unsubscribe or change your preferences</a></p>`;
      return { text, html };
    }
    case "donation_receipt": {
      const name = String(data.donor_name ?? "Friend");
      const amount = String(data.amount ?? "");
      const currency = String(data.currency ?? "");
      const donation_id = String(data.donation_id ?? "");
      const date = String(data.date ?? "");
      const project = data.project_name ? ` in support of ${String(data.project_name)}` : "";
      const text = [
        `Dear ${name},`,
        "",
        `Thank you for your gift of ${currency} ${amount}${project}.`,
        "",
        `This email serves as your acknowledgement of receipt.`,
        `Donation reference: ${donation_id}`,
        `Date: ${date}`,
        "",
        "Sarah's Foundation",
      ].join("\n");
      const html = `<p>Dear ${esc(name)},</p>
<p>Thank you for your gift of <strong>${esc(currency)} ${esc(amount)}</strong>${project ? " " + esc(project) : ""}.</p>
<p>This email serves as your acknowledgement of receipt.</p>
<p>Donation reference: <code>${esc(donation_id)}</code><br/>Date: ${esc(date)}</p>
<p>— Sarah's Foundation</p>`;
      return { text, html };
    }
    default:
      return { text: "", html: "" };
  }
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
  );
}
