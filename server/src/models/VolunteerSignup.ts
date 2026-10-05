import mongoose, { Schema } from "mongoose";

// Moved from the Next.js API route into the API in Phase 1.

export const VOLUNTEER_TASKS = [
  "social-media",
  "text-marketing",
  "email-marketing",
  "flyer-distribution",
  "wherever-needed",
] as const;
export type VolunteerTask = (typeof VOLUNTEER_TASKS)[number];

export type Address = {
  line1: string;
  line2?: string | null;
  city: string;
  state_province?: string | null;
  postal_code: string;
  country: string;
};

export type VolunteerSignupDoc = {
  _id: mongoose.Types.ObjectId;
  organization_id: mongoose.Types.ObjectId;
  full_name: string;
  email: string;
  phone: string | null;
  country: string;
  city_region: string;
  tasks: VolunteerTask[];
  address: Address | null;
  note: string | null;
  consent: boolean;
  source: string;
  ip: string;
  user_agent: string;
  submitted_at: Date;
  created_at: Date;
};

const AddressSchema = new Schema<Address>(
  {
    line1: { type: String, required: true, maxlength: 160 },
    line2: { type: String, default: null, maxlength: 160 },
    city: { type: String, required: true, maxlength: 80 },
    state_province: { type: String, default: null, maxlength: 80 },
    postal_code: { type: String, required: true, maxlength: 20 },
    country: { type: String, required: true, maxlength: 80 },
  },
  { _id: false }
);

const VolunteerSignupSchema = new Schema<VolunteerSignupDoc>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    full_name: { type: String, required: true, maxlength: 120 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, default: null, maxlength: 32 },
    country: { type: String, required: true, maxlength: 80 },
    city_region: { type: String, required: true, maxlength: 120 },
    tasks: { type: [String], enum: VOLUNTEER_TASKS, required: true },
    address: { type: AddressSchema, default: null },
    note: { type: String, default: null, maxlength: 2000 },
    consent: { type: Boolean, required: true },
    source: { type: String, default: "website", maxlength: 64 },
    ip: { type: String, default: "", maxlength: 64 },
    user_agent: { type: String, default: "", maxlength: 500 },
    submitted_at: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false }, collection: "volunteer_signups" }
);

VolunteerSignupSchema.index({ organization_id: 1, submitted_at: -1 });
VolunteerSignupSchema.index({ organization_id: 1, email: 1 });

export const VolunteerSignup =
  mongoose.models.VolunteerSignup ??
  mongoose.model<VolunteerSignupDoc>("VolunteerSignup", VolunteerSignupSchema);
