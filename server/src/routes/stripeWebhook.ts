import express, { Router } from "express";
import { log } from "@/util/log.js";
import { ingestStripeEvent, verifyStripeSignature } from "@/services/stripeWebhook.js";

const router = Router();

router.post(
  "/stripe",
  express.raw({ type: "application/json", limit: "256kb" }),
  async (req, res, next) => {
    try {
      const raw = (req.body as Buffer).toString("utf-8");
      const sig = req.header("stripe-signature");
      if (!verifyStripeSignature(raw, sig)) {
        res.status(401).json({ error: { code: "unauthorized", message: "bad signature" } });
        return;
      }
      let payload: unknown;
      try {
        payload = JSON.parse(raw);
      } catch {
        res.status(400).json({ error: { code: "bad_request", message: "bad json" } });
        return;
      }
      const result = await ingestStripeEvent(payload);
      log.info({ outcome: result.outcome }, "stripe.webhook.ingest");
      res.status(200).json({ data: { outcome: result.outcome } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
