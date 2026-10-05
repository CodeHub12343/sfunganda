// =============================================================================
// Error model (§10.2). One AppError type with a stable `code`, mapped to an
// HTTP status. Responses are `{ error: { code, message, fields? } }`.
// Internal messages (DB stack traces etc.) never reach the client — they are
// logged with the request ID and swallowed into "internal_error".
// =============================================================================

export type ErrorCode =
  | "bad_request"
  | "unauthorized"
  | "mfa_required"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "idempotency_conflict"
  | "version_conflict"
  | "rate_limited"
  | "unprocessable"
  | "internal_error"
  | "unavailable";

export const CODE_STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  mfa_required: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  idempotency_conflict: 409,
  version_conflict: 409,
  rate_limited: 429,
  unprocessable: 422,
  internal_error: 500,
  unavailable: 503,
};

export type FieldErrors = Record<string, string>;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields?: FieldErrors;
  constructor(code: ErrorCode, message: string, opts?: { fields?: FieldErrors; cause?: unknown }) {
    super(message);
    this.code = code;
    this.status = CODE_STATUS[code];
    if (opts?.fields) this.fields = opts.fields;
    if (opts?.cause) (this as { cause?: unknown }).cause = opts.cause;
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
