import { z } from "zod";
import { email, nonEmpty, objectId } from "./common.js";

export const supporterSignupBody = z.object({
  email,
  display_name: nonEmpty(120),
  password: z.string().min(12).max(1024),
  country: z.string().max(80).optional(),
  consent: z.literal(true),
  // Honeypot — field that human users won't fill. Clients leave empty.
  website: z.string().optional(),
});
export type SupporterSignupBody = z.infer<typeof supporterSignupBody>;

export const verifyEmailBody = z.object({
  token: z.string().min(10).max(100),
});

export const resendVerificationBody = z.object({
  email,
});

export const notificationFrequency = z.enum(["immediate", "daily_digest", "weekly_digest", "off"]);

export const preferencesBody = z.object({
  anonymous_on_wall: z.boolean().optional(),
  prefs: z
    .object({
      accomplishment_published: notificationFrequency.optional(),
      milestone_completed: notificationFrequency.optional(),
      project_update: notificationFrequency.optional(),
      donation_receipt: notificationFrequency.optional(),
      channels: z
        .object({ email: z.boolean().optional(), in_app: z.boolean().optional() })
        .optional(),
      unsubscribed_all: z.boolean().optional(),
    })
    .optional(),
});

export const followBody = z.object({
  project_id: objectId,
});

export const deletionRequestBody = z.object({
  confirm_email: email,
});
