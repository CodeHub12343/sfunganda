import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler, parseBody } from "./_shared.js";
import { donateCheckoutBody } from "@shared/schemas/finance.js";
import { createCheckoutSession } from "@/services/donations.js";
import { getAuthOrNull } from "@/middleware/authMiddleware.js";

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
    // If the donor is signed in, trust the session over the form fields.
    // The webhook will stamp the resulting donation with this id so it
    // shows up in their dashboard regardless of which email they type at
    // Stripe checkout.
    const auth = getAuthOrNull(req);
    const result = await createCheckoutSession({
      ...body,
      supporter_user_id: auth?.actor.user_id,
    });
    res.json({ data: result });
  })
);

export default router;
