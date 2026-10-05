import type { Request, Response, NextFunction } from "express";
import type { ZodTypeAny, z } from "zod";
import { AppError } from "@/util/errors.js";
import type { AuthState } from "@/middleware/authMiddleware.js";
import { getRequestId } from "@/middleware/requestContext.js";
import type { RequestCtx } from "@/services/users.js";

export function parseBody<T extends ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const r = schema.safeParse(body);
  if (!r.success) {
    const fields: Record<string, string> = {};
    for (const issue of r.error.issues) {
      fields[issue.path.join(".") || "_"] = issue.message;
    }
    throw new AppError("bad_request", "validation failed", { fields });
  }
  return r.data;
}

export function asyncHandler<T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>>(
  fn: T
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

export function requestCtx(req: Request): RequestCtx {
  return {
    ip: (req.header("x-forwarded-for")?.split(",")[0] ?? req.ip ?? "").trim().slice(0, 64),
    user_agent: (req.header("user-agent") ?? "").slice(0, 500),
    request_id: getRequestId(req),
  };
}

export function auth(req: Request): AuthState {
  const auth = (req as unknown as { auth?: AuthState }).auth;
  if (!auth) throw new AppError("unauthorized", "sign in required");
  return auth;
}
