import { createHash, createHmac } from "node:crypto";
import { env } from "@/config/env.js";
import { AppError } from "@/util/errors.js";
import { log } from "@/util/log.js";

// =============================================================================
// S3-compatible storage (Cloudflare R2). We don't take a 500 KB SDK on just
// to presign and run multipart; SigV4 is 40 lines of Node crypto. All public
// surface here speaks in "logical buckets" (originals / derivatives /
// documents) so callers never hard-code bucket names.
// =============================================================================

export type LogicalBucket = "originals" | "derivatives" | "documents";

export function bucketName(logical: LogicalBucket): string {
  switch (logical) {
    case "originals":
      return env.R2_BUCKET_ORIGINALS;
    case "derivatives":
      return env.R2_BUCKET_DERIVATIVES;
    case "documents":
      return env.R2_BUCKET_DOCUMENTS;
  }
}

function assertConfigured(): void {
  if (!env.R2_ENDPOINT || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new AppError("unavailable", "object storage is not configured");
  }
}

// ---- SigV4 presign ---------------------------------------------------------

const SERVICE = "s3";

function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}
function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}
function signingKey(secret: string, date: string, region: string): Buffer {
  const kDate = hmac("AWS4" + secret, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, "aws4_request");
}

function amzDate(d: Date = new Date()): { amz: string; date: string } {
  const iso = d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return { amz: iso, date: iso.slice(0, 8) };
}

function endpointHost(): string {
  assertConfigured();
  return new URL(env.R2_ENDPOINT!).host;
}

function uriEncode(s: string, encodeSlash = true): string {
  // RFC 3986 unreserved. S3 requires strict percent-encoding of path/query.
  return s
    .split("")
    .map((c) => {
      if (/[A-Za-z0-9\-._~]/.test(c)) return c;
      if (c === "/" && !encodeSlash) return c;
      return c
        .split("")
        .map((ch) => "%" + ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"))
        .join("");
    })
    .join("");
}

// Query presign (works for GET and PUT), used by callers for signed-URL
// downloads and for simple small-file browser PUT.
export function presignUrl(opts: {
  method: "GET" | "PUT" | "DELETE";
  bucket: string;
  key: string;
  ttlSeconds: number;
  contentType?: string;
  contentSha256?: string;
  responseContentDisposition?: string;
  query?: Record<string, string>;
}): string {
  assertConfigured();
  const host = endpointHost();
  const region = env.R2_REGION;
  const { amz, date } = amzDate();
  const credential = `${env.R2_ACCESS_KEY_ID}/${date}/${region}/${SERVICE}/aws4_request`;

  const canonicalUri = `/${uriEncode(opts.bucket, false)}/${uriEncode(opts.key, false)}`;
  const signedHeaders = "host";
  const payloadHash = opts.contentSha256 ?? "UNSIGNED-PAYLOAD";

  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": amz,
    "X-Amz-Expires": String(opts.ttlSeconds),
    "X-Amz-SignedHeaders": signedHeaders,
    ...(opts.responseContentDisposition
      ? { "response-content-disposition": opts.responseContentDisposition }
      : {}),
    ...(opts.query ?? {}),
  };

  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${uriEncode(k)}=${uriEncode(query[k])}`)
    .join("&");

  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = [
    opts.method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amz,
    `${date}/${region}/${SERVICE}/aws4_request`,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signature = createHmac("sha256", signingKey(env.R2_SECRET_ACCESS_KEY!, date, region))
    .update(stringToSign)
    .digest("hex");

  return `${env.R2_ENDPOINT!.replace(/\/$/, "")}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

// ---- Direct S3 API calls (header-signed) -----------------------------------
// For server-side operations (multipart init, complete, delete) we need
// header-signed requests, not presigned URLs.

async function signedRequest(
  method: string,
  path: string,
  opts: { query?: Record<string, string>; body?: string | Buffer; contentType?: string } = {}
): Promise<Response> {
  assertConfigured();
  const url = new URL(env.R2_ENDPOINT!.replace(/\/$/, "") + path);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);
  const body = opts.body ?? "";
  const bodyBuf = typeof body === "string" ? Buffer.from(body) : body;
  const payloadHash = sha256Hex(bodyBuf);

  const { amz, date } = amzDate();
  const region = env.R2_REGION;
  const host = url.host;

  const canonicalUri = url.pathname
    .split("/")
    .map((seg) => uriEncode(seg, false))
    .join("/");
  const canonicalQuery = [...url.searchParams.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${uriEncode(k)}=${uriEncode(v)}`)
    .join("&");

  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amz,
  };
  if (opts.contentType) headers["content-type"] = opts.contentType;
  if (bodyBuf.length > 0) headers["content-length"] = String(bodyBuf.length);

  const signedHeaderNames = Object.keys(headers)
    .map((h) => h.toLowerCase())
    .sort();
  const canonicalHeaders =
    signedHeaderNames.map((h) => `${h}:${String(headers[h]).trim()}`).join("\n") + "\n";
  const signedHeaders = signedHeaderNames.join(";");

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credential = `${env.R2_ACCESS_KEY_ID}/${date}/${region}/${SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amz,
    `${date}/${region}/${SERVICE}/aws4_request`,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signature = createHmac("sha256", signingKey(env.R2_SECRET_ACCESS_KEY!, date, region))
    .update(stringToSign)
    .digest("hex");

  const authorization = `AWS4-HMAC-SHA256 Credential=${credential}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(url.toString(), {
    method,
    headers: { ...headers, authorization },
    body: method === "GET" || method === "DELETE" ? undefined : bodyBuf,
  });

  return res;
}

export async function initMultipartUpload(
  bucket: string,
  key: string,
  contentType: string
): Promise<string> {
  const res = await signedRequest("POST", `/${bucket}/${key}`, {
    query: { uploads: "" },
    contentType,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    log.error({ status: res.status, text }, "storage.multipart_init_failed");
    throw new AppError("unavailable", "could not start upload");
  }
  const body = await res.text();
  const uploadId = body.match(/<UploadId>([^<]+)<\/UploadId>/)?.[1];
  if (!uploadId) throw new AppError("unavailable", "could not start upload");
  return uploadId;
}

export function presignUploadPartUrl(
  bucket: string,
  key: string,
  uploadId: string,
  partNumber: number,
  ttlSeconds: number
): string {
  return presignUrl({
    method: "PUT",
    bucket,
    key,
    ttlSeconds,
    query: { partNumber: String(partNumber), uploadId },
  });
}

export async function completeMultipartUpload(
  bucket: string,
  key: string,
  uploadId: string,
  parts: Array<{ part_number: number; etag: string }>
): Promise<void> {
  const sorted = [...parts].sort((a, b) => a.part_number - b.part_number);
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<CompleteMultipartUpload>",
    ...sorted.map(
      (p) =>
        `<Part><PartNumber>${p.part_number}</PartNumber><ETag>${escapeXml(p.etag)}</ETag></Part>`
    ),
    "</CompleteMultipartUpload>",
  ].join("");
  const res = await signedRequest("POST", `/${bucket}/${key}`, {
    query: { uploadId },
    body,
    contentType: "application/xml",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    log.error({ status: res.status, text }, "storage.multipart_complete_failed");
    throw new AppError("unavailable", "could not finish upload");
  }
}

export async function abortMultipartUpload(
  bucket: string,
  key: string,
  uploadId: string
): Promise<void> {
  await signedRequest("DELETE", `/${bucket}/${key}`, { query: { uploadId } }).catch(() => undefined);
}

export async function deleteObject(bucket: string, key: string): Promise<void> {
  const res = await signedRequest("DELETE", `/${bucket}/${key}`);
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "");
    log.warn({ status: res.status, text, bucket, key }, "storage.delete_failed");
  }
}

export async function getObject(bucket: string, key: string): Promise<Buffer | null> {
  const res = await signedRequest("GET", `/${bucket}/${key}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    log.error({ status: res.status, bucket, key }, "storage.get_failed");
    throw new AppError("unavailable", "could not read object");
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

export async function putObject(
  bucket: string,
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const res = await signedRequest("PUT", `/${bucket}/${key}`, { body, contentType });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    log.error({ status: res.status, text, bucket, key }, "storage.put_failed");
    throw new AppError("unavailable", "could not write object");
  }
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === "'" ? "&apos;" : "&quot;"
  );
}

// Deterministic object key: year/month/{uuid}/{basename-sanitized}.
export function buildKey(prefix: string, filename: string): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const safe =
    filename
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 120) || "file";
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}/${year}/${month}/${rand}/${safe}`;
}
