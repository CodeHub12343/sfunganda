import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler, parseBody } from "./_shared.js";
import { donateCheckoutBody } from "@shared/schemas/finance.js";
import { createCheckoutSession } from "@/services/donations.js";

const router = Router();

const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  "/checkout",
  limiter,
  asyncHandler(async (req, res) => {
    const body = parseBody(donateCheckoutBody, req.body);
    const result = await createCheckoutSession(body);
    res.json({ data: result });
  })
);

export default router;
