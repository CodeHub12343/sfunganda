import { z } from "zod";

export const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "invalid id");
export const nonEmpty = (max: number) => z.string().min(1).max(max).trim();
export const email = z.string().email().max(254).toLowerCase().trim();
export const slug = z.string().regex(/^[a-z0-9-]{1,120}$/);
export const cursor = z.string().max(200).optional();
export const currency = z.string().length(3).toUpperCase();

export const envelope = <T extends z.ZodTypeAny>(data: T) => z.object({ data });

// Role / scope.
export const roleEnum = z.enum([
  "founder",
  "director",
  "project_manager",
  "finance_manager",
  "media_manager",
  "field_member",
  "supporter",
]);
export const scopeTypeEnum = z.enum(["organization", "community", "project"]);

export const volunteerTasks = z.enum([
  "social-media",
  "text-marketing",
  "email-marketing",
  "flyer-distribution",
  "wherever-needed",
]);

export const addressSchema = z.object({
  line1: nonEmpty(160),
  line2: z.string().max(160).optional().nullable(),
  city: nonEmpty(80),
  state_province: z.string().max(80).optional().nullable(),
  postal_code: nonEmpty(20),
  country: nonEmpty(80),
});

export const volunteerBody = z.object({
  full_name: nonEmpty(120),
  email,
  phone: z.string().max(32).optional().nullable(),
  country: nonEmpty(80),
  city_region: nonEmpty(120),
  tasks: z.array(volunteerTasks).min(1),
  address: addressSchema.optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
  consent: z.literal(true),
  source: z.string().max(64).optional(),
  website: z.string().optional(), // honeypot — ignored
});
export type VolunteerBody = z.infer<typeof volunteerBody>;

export const checkoutBody = z.object({
  amount: z.union([z.number(), z.string()]),
  monthly: z.boolean().optional().default(false),
});

export const signInBody = z.object({
  email,
  password: z.string().min(1).max(1024),
});

export const inviteBody = z.object({
  email,
  display_name: nonEmpty(120),
  role: roleEnum,
  scope_type: scopeTypeEnum,
  scope_id: objectId.nullable().optional(),
});

export const assignRoleBody = z.object({
  role: roleEnum,
  scope_type: scopeTypeEnum,
  scope_id: objectId.nullable().optional(),
});

export const acceptInviteBody = z.object({
  token: z.string().min(10).max(100),
  password: z.string().min(12).max(1024),
  // Confirm the invited name — defensive; also lets the UI prompt for it.
  display_name: nonEmpty(120).optional(),
});

export const mfaBody = z.object({
  token: z.string().min(6).max(32),
});
