import mongoose from "mongoose";
import { AppError } from "@/util/errors.js";
import { VolunteerSignup } from "@/models/index.js";
import { writeAudit } from "./audit.js";
import { enqueue } from "./outbox.js";

export type VolunteerInput = {
  organization_id: mongoose.Types.ObjectId;
  full_name: string;
  email: string;
  phone: string | null;
  country: string;
  city_region: string;
  tasks: string[];
  address: {
    line1: string;
    line2?: string | null;
    city: string;
    state_province?: string | null;
    postal_code: string;
    country: string;
  } | null;
  note: string | null;
  consent: boolean;
  source?: string;
  ip: string;
  user_agent: string;
  request_id: string;
};

export async function recordVolunteerSignup(input: VolunteerInput): Promise<{ id: string }> {
  if (!input.consent) throw new AppError("bad_request", "consent is required");

  const session = await mongoose.startSession();
  try {
    let id!: mongoose.Types.ObjectId;
    await session.withTransaction(async () => {
      const [doc] = await VolunteerSignup.create(
        [
          {
            organization_id: input.organization_id,
            full_name: input.full_name,
            email: input.email.toLowerCase(),
            phone: input.phone,
            country: input.country,
            city_region: input.city_region,
            tasks: input.tasks,
            address: input.address,
            note: input.note,
            consent: true,
            source: input.source ?? "website",
            ip: input.ip,
            user_agent: input.user_agent,
            submitted_at: new Date(),
          },
        ],
        { session }
      );
      id = doc._id;

      await writeAudit(
        {
          organization_id: input.organization_id,
          actor_id: null,
          actor_role: null,
          action: "volunteer.signup",
          entity_type: "volunteer_signup",
          entity_id: id,
          after: { tasks: input.tasks, country: input.country },
          ip: input.ip,
          user_agent: input.user_agent,
          request_id: input.request_id,
        },
        session
      );

      const notifyTo = process.env.VOLUNTEER_NOTIFY_TO;
      if (notifyTo) {
        const addressStr = input.address
          ? `${input.address.line1}${input.address.line2 ? ", " + input.address.line2 : ""}, ${input.address.city}, ${input.address.state_province ?? ""} ${input.address.postal_code}, ${input.address.country}`
          : null;
        await enqueue(
          {
            organization_id: input.organization_id,
            topic: "mail.volunteer_notify",
            payload: {
              to: notifyTo,
              full_name: input.full_name,
              email: input.email,
              phone: input.phone,
              country: input.country,
              city_region: input.city_region,
              tasks: input.tasks,
              address: addressStr,
              note: input.note,
            },
          },
          session
        );
      }
    });
    return { id: id.toString() };
  } finally {
    await session.endSession();
  }
}
