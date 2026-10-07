import express, { Router } from "express";
import { log } from "@/util/log.js";
import { verifyStreamSignature } from "@/services/videoProvider.js";
import { markProviderReady } from "@/services/media.js";
import { MediaAsset } from "@/models/index.js";

const router = Router();

// Stream webhooks ship JSON but we must sign-verify over the raw bytes, so
// capture them with a tight express.raw() before parsing.
router.post(
  "/stream",
  express.raw({ type: "application/json", limit: "64kb" }),
  async (req, res, next) => {
    try {
      const raw = (req.body as Buffer).toString("utf-8");
      const sig = req.header("webhook-signature");
      if (!verifyStreamSignature(raw, sig)) {
        res.status(401).json({ error: { code: "unauthorized", message: "bad signature" } });
        return;
      }
      const payload = JSON.parse(raw) as {
        uid?: string;
        readyToStream?: boolean;
        playback?: { hls?: string; dash?: string };
        duration?: number;
        input?: { width?: number; height?: number };
        meta?: Record<string, unknown>;
      };
      if (!payload.uid) {
        res.status(400).json({ error: { code: "bad_request", message: "no uid" } });
        return;
      }
      const asset = await MediaAsset.findOne({ "provider.asset_id": payload.uid });
      if (!asset) {
        log.warn({ uid: payload.uid }, "stream.webhook.unknown_asset");
        res.status(204).end();
        return;
      }
      if (payload.readyToStream) {
        asset.duration_seconds = payload.duration ?? asset.duration_seconds;
        asset.width = payload.input?.width ?? asset.width;
        asset.height = payload.input?.height ?? asset.height;
        await asset.save();
        await markProviderReady(asset._id.toString(), payload.uid);
      } else {
        asset.status = "pending_processing";
        await asset.save();
      }
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
