import type { NextFunction, Request, Response } from "express";
import { randomId } from "@/util/ids.js";
import { env } from "@/config/env.js";
import { AppError } from "@/util/errors.js";

// =============================================================================
// Request ID. One per request, echoed in `X-Request-Id` so logs and audit
// rows can be traced across the API, the worker, and the front end.
// =============================================================================

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-request-id");
  const id = (incoming && /^[a-zA-Z0-9_-]{8,64}$/.test(incoming) ? incoming : randomId()).slice(0, 64);
  (req as unknown as { request_id: string }).request_id = id;
  res.setHeader("X-Request-Id", id);
  next();
}

// =============================================================================
// Origin check (§10.2). Every non-GET must come from an allow-listed origin.
// Browsers always send Origin on cross-site POST/PUT/PATCH/DELETE, which is
// our CSRF defence alongside SameSite=Lax session cookies.
// =============================================================================

export function originCheck(req: Request, _res: Response, next: NextFunction): void {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }
  const origin = req.header("origin") ?? "";
  const allowed = env.CORS_ORIGINS;
  if (!origin || !allowed.includes(origin)) {
    return next(new AppError("forbidden", "origin not allowed"));
  }
  next();
}

// =============================================================================
// Internal proxy guard. Every request that reaches the API from the Next.js
// rewrite layer carries `x-internal-secret`. Requests without it are either
// server-to-server callers we trust (webhooks that bring their own signature)
// or someone probing the API directly — refused.
// =============================================================================

export function internalProxyRequired(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header("x-internal-secret") ?? "";
  if (header === env.INTERNAL_PROXY_SECRET) return next();
  next(new AppError("forbidden", "internal secret missing or wrong"));
}

export function getRequestId(req: Request): string {
  return (req as unknown as { request_id?: string }).request_id ?? "";
}
