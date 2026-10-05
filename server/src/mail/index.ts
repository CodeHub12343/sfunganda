import nodemailer, { type Transporter } from "nodemailer";
import { env, isProd } from "@/config/env.js";
import { log } from "@/util/log.js";

// Mail wrapper. Delivery is async: the outbox worker calls `send()`, logs
// errors into the event, and retries with exponential backoff. We never send
// mail synchronously from a request handler.

let cached: Transporter | null = null;

function getTransport(): Transporter {
  if (cached) return cached;
  cached = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASS ?? "" }
      : undefined,
  });
  return cached;
}

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendMail(msg: MailMessage): Promise<void> {
  const info = await getTransport().sendMail({
    from: env.MAIL_FROM,
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    html: msg.html,
  });
  if (!isProd()) log.debug({ messageId: info.messageId }, "mail.sent");
}

// --------- Templates ---------

export function inviteTemplate(args: {
  invitee_name: string;
  inviter_name: string;
  organization_name: string;
  accept_url: string;
  expires_at: Date;
}): MailMessage {
  const text = [
    `Hi ${args.invitee_name},`,
    "",
    `${args.inviter_name} has invited you to join ${args.organization_name}.`,
    "",
    "Accept the invitation by opening this link:",
    args.accept_url,
    "",
    `The link expires at ${args.expires_at.toISOString()}.`,
    "",
    "If you weren't expecting this invitation, you can ignore it.",
    "",
    "— Sarah's Foundation",
  ].join("\n");
  return {
    to: "", // filled by the worker from the outbox payload
    subject: `You're invited to ${args.organization_name}`,
    text,
  };
}

export function volunteerTemplate(args: {
  full_name: string;
  email: string;
  phone: string | null;
  country: string;
  city_region: string;
  tasks: string[];
  address: string | null;
  note: string | null;
}): MailMessage {
  const text = [
    `New volunteer: ${args.full_name}`,
    `Email: ${args.email}`,
    `Phone: ${args.phone ?? "—"}`,
    `Location: ${args.city_region}, ${args.country}`,
    `Tasks: ${args.tasks.join(", ")}`,
    `Mailing address: ${args.address ?? "—"}`,
    `Note: ${args.note ?? "—"}`,
  ].join("\n");
  return {
    to: "", // filled by the worker from VOLUNTEER_NOTIFY_TO (via payload)
    subject: `New volunteer: ${args.full_name} (${args.country})`,
    text,
  };
}
