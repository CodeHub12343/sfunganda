import express, { type Request, type Response, type NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { env } from "@/config/env.js";
import { log } from "@/util/log.js";
import { AppError, isAppError } from "@/util/errors.js";
import { requestId, originCheck, internalProxyRequired, getRequestId } from "@/middleware/requestContext.js";
import { attachAuth } from "@/middleware/authMiddleware.js";
import authRoutes from "./routes/auth.js";
import meRoutes from "./routes/me.js";
import adminUsersRoutes from "./routes/adminUsers.js";
import auditRoutes from "./routes/audit.js";
import donationsRoutes from "./routes/donations.js";
import volunteersRoutes from "./routes/volunteers.js";
import healthRoutes from "./routes/health.js";
import mediaRoutes from "./routes/media.js";
import videosRoutes from "./routes/videos.js";
import mediaWebhookRoutes from "./routes/mediaWebhooks.js";

export function buildApp() {
  const app = express();

  // Trust first proxy — Cloudflare / Next.js rewrite layer / load balancer.
  app.set("trust proxy", 1);

  // Request id (first, so every log line and audit row carries it).
  app.use(requestId);

  app.use(
    pinoHttp({
      logger: log,
      genReqId: (req) => getRequestId(req as Request),
      autoLogging: {
        ignore: (req) =>
          req.url?.startsWith("/health/") || req.url === "/favicon.ico" || false,
      },
      serializers: {
        req(req) {
          return { method: req.method, url: req.url, request_id: getRequestId(req as unknown as Request) };
        },
      },
    })
  );

  // Security headers. The front end sets its own CSP; this layer just hardens
  // the API itself. CORS allow-list is strict — only the configured origins.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "same-site" } }));
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true); // allow server-to-server (e.g. health probes)
        if (env.CORS_ORIGINS.includes(origin)) return cb(null, true);
        cb(new AppError("forbidden", "origin not allowed"));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["content-type", "x-request-id", "x-internal-secret", "idempotency-key"],
    })
  );

  // Body limits (§10.2). JSON only.
  app.use(express.json({ limit: "64kb" }));
  app.use(cookieParser());

  // Health is public and does not require the proxy secret.
  app.use("/health", healthRoutes);

  // Provider webhooks ship their own authenticity signatures and must not
  // go through the internal-proxy gate. Mount BEFORE the gate so the
  // provider talks to the API directly.
  app.use("/v1/webhooks", mediaWebhookRoutes);

  // Everything else must come through our Next.js rewrite layer (or an
  // explicit server-to-server caller with the shared secret).
  app.use(internalProxyRequired);

  // CSRF: Origin check on every non-GET (SameSite=Lax cookies +
  // allow-list origins + JSON-only bodies).
  app.use(originCheck);

  app.use(attachAuth);

  app.use("/v1/auth", authRoutes);
  app.use("/v1/me", meRoutes);
  app.use("/v1/admin/users", adminUsersRoutes);
  app.use("/v1/audit", auditRoutes);
  app.use("/v1/donations", donationsRoutes);
  app.use("/v1/volunteers", volunteersRoutes);
  app.use("/v1/media", mediaRoutes);
  app.use("/v1/videos", videosRoutes);

  // 404
  app.use((_req, _res, next) => next(new AppError("not_found", "not found")));

  // Error handler — one shape, no internal messages leaked.
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const request_id = getRequestId(req);
    if (isAppError(err)) {
      log.warn({ err: err.code, request_id }, "request.app_error");
      res.status(err.status).json({
        error: { code: err.code, message: err.message, fields: err.fields },
        request_id,
      });
      return;
    }
    log.error(
      { err: err instanceof Error ? err.message : "unknown", stack: err instanceof Error ? err.stack : undefined, request_id },
      "request.internal_error"
    );
    res.status(500).json({
      error: { code: "internal_error", message: "something went wrong" },
      request_id,
    });
  });

  return app;
}
