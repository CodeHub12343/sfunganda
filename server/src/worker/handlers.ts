import type mongoose from "mongoose";
import { log } from "@/util/log.js";
import { sendMail, inviteTemplate, volunteerTemplate } from "@/mail/index.js";
import { env } from "@/config/env.js";

// Topic handlers. Each must be idempotent — the worker guarantees "at least
// once" delivery, so handlers must detect-and-skip repeated work.
export type HandlerCtx = {
  event_id: string;
  organization_id: mongoose.Types.ObjectId;
};

export type HandlerFn = (payload: Record<string, unknown>, ctx: HandlerCtx) => Promise<void>;

const handlers: Record<string, HandlerFn> = {
  async "mail.invite"(payload) {
    const to = String(payload.to);
    const tpl = inviteTemplate({
      invitee_name: String(payload.invitee_name),
      inviter_name: String(payload.inviter_name),
      organization_name: String(payload.organization_name),
      accept_url: String(payload.accept_url),
      expires_at: new Date(String(payload.expires_at)),
    });
    await sendMail({ ...tpl, to });
  },

  async "mail.volunteer_notify"(payload) {
    const to = String(payload.to);
    const tpl = volunteerTemplate({
      full_name: String(payload.full_name),
      email: String(payload.email),
      phone: (payload.phone as string | null) ?? null,
      country: String(payload.country),
      city_region: String(payload.city_region),
      tasks: payload.tasks as string[],
      address: (payload.address as string | null) ?? null,
      note: (payload.note as string | null) ?? null,
    });
    await sendMail({ ...tpl, to });
  },

  async "noop"(payload, ctx) {
    log.info({ ctx, payload }, "noop handler");
  },
};

// Allow MAIL recipient env override at handler time (not stored in audit).
export function resolveVolunteerRecipient(): string | null {
  return process.env.VOLUNTEER_NOTIFY_TO ?? null;
}

// Keep env unused warning silenced in this file — env is referenced indirectly
// through mail wrapper.
void env;

export function getHandler(topic: string): HandlerFn | undefined {
  return handlers[topic];
}
