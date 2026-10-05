// Typed API client for the Express service. Server Components and the browser
// both use this — on the server it talks to the API's internal origin, on the
// browser it talks to `/api/v1/*` so cookies stay first-party (the Next.js
// rewrite in next.config.mjs forwards those paths).

export type ApiError = {
  code: string;
  message: string;
  fields?: Record<string, string>;
};

export type ApiResponse<T> = { data: T } | { error: ApiError };

function base(): string {
  if (typeof window !== "undefined") return "/api/v1";
  // Server-side: talk to the API directly if configured; otherwise fall
  // back to the public rewrite path so dev works end-to-end.
  const direct = process.env.API_ORIGIN;
  return direct ? `${direct}/v1` : "/api/v1";
}

export class ApiClientError extends Error {
  constructor(public code: string, message: string, public fields?: Record<string, string>) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const { json, headers, ...rest } = init;
  const h = new Headers(headers);
  const method = (rest.method ?? (json !== undefined ? "POST" : "GET")).toUpperCase();
  if (json !== undefined) h.set("content-type", "application/json");

  // On the server, we're bypassing the Next rewrite layer, so include the
  // internal secret directly.
  if (typeof window === "undefined" && process.env.INTERNAL_PROXY_SECRET) {
    h.set("x-internal-secret", process.env.INTERNAL_PROXY_SECRET);
  }

  const res = await fetch(`${base()}${path}`, {
    ...rest,
    method,
    headers: h,
    credentials: typeof window !== "undefined" ? "same-origin" : rest.credentials,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  const payload = (await res.json().catch(() => ({}))) as ApiResponse<T> & {
    data?: T;
    error?: ApiError;
  };

  if (!res.ok || payload.error) {
    const err = payload.error ?? { code: "internal_error", message: "request failed" };
    throw new ApiClientError(err.code, err.message, err.fields);
  }
  return payload.data as T;
}
