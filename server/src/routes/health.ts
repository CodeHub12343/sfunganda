import { Router } from "express";
import { isConnected } from "@/config/db.js";

const router = Router();

router.get("/live", (_req, res) => {
  res.setHeader("cache-control", "no-store");
  res.json({ status: "ok", service: "sfu-api", at: new Date().toISOString() });
});

router.get("/ready", (_req, res) => {
  res.setHeader("cache-control", "no-store");
  const ok = isConnected();
  res.status(ok ? 200 : 503).json({
    status: ok ? "ok" : "degraded",
    db: ok ? "connected" : "disconnected",
    at: new Date().toISOString(),
  });
});

export default router;
