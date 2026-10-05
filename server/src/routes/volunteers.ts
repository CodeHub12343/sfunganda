import { Router } from "express";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { asyncHandler, parseBody, requestCtx } from "./_shared.js";
import { volunteerBody } from "@shared/schemas/common.js";
import { Organization } from "@/models/index.js";
import { recordVolunteerSignup } from "@/services/volunteers.js";
import { AppError } from "@/util/errors.js";

const router = Router();

const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

async function defaultOrgId(): Promise<mongoose.Types.ObjectId> {
  const org = await Organization.findOne({}).sort({ created_at: 1 }).lean();
  if (!org) throw new AppError("unavailable", "no organization configured");
  return org._id;
}

router.post(
  "/",
  limiter,
  asyncHandler(async (req, res) => {
    const body = parseBody(volunteerBody, req.body);
    // Honeypot (bots fill a hidden field). Pretend success.
    if (body.website && body.website.trim() !== "") {
      res.json({ data: { ok: true } });
      return;
    }
    if (body.tasks.includes("text-marketing") && !body.phone) {
      throw new AppError("bad_request", "phone is required for text-marketing", {
        fields: { phone: "required" },
      });
    }
    if (body.tasks.includes("flyer-distribution") && !body.address) {
      throw new AppError("bad_request", "a mailing address is required for flyer-distribution", {
        fields: { address: "required" },
      });
    }
    const ctx = requestCtx(req);
    const organization_id = await defaultOrgId();
    const result = await recordVolunteerSignup({
      organization_id,
      full_name: body.full_name,
      email: body.email,
      phone: body.phone ?? null,
      country: body.country,
      city_region: body.city_region,
      tasks: body.tasks,
      address: body.address ?? null,
      note: body.note ?? null,
      consent: true,
      source: body.source,
      ip: ctx.ip,
      user_agent: ctx.user_agent,
      request_id: ctx.request_id,
    });
    res.status(201).json({ data: result });
  })
);

export default router;
