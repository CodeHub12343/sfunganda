import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "@/config/env.js";
import { AppError } from "@/util/errors.js";

// =============================================================================
// Field-level encryption (§19.3 "names and birth dates encrypted at field
// level by the driver before they reach the database, with the key held
// outside it").
//
// AES-256-GCM with a 96-bit IV and 128-bit auth tag. The payload is a
// compact JSON object stored in the field:
//
//   { v: 1, kid: "<id>", iv: "<b64>", ct: "<b64>", tag: "<b64>" }
//
// `kid` identifies the key version so rotation is read-compatible: new
// writes use the current key; reads try the current key, then the one
// named by `_PREV`. Rotating is a two-step operator action — set
// FIELD_ENCRYPTION_KEY_PREV = <current>, then set FIELD_ENCRYPTION_KEY to
// the new material, deploy, and over time run a background re-encrypt
// pass; this module ships the primitives, not the pass.
//
// Keys are 32 bytes of random, encoded as base64 (standard, not URL).
// =============================================================================

export type EncryptedField = {
  v: 1;
  kid: string;
  iv: string;
  ct: string;
  tag: string;
};

function parseKey(raw: string | undefined): Buffer | null {
  if (!raw) return null;
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) return null;
  return buf;
}

function keyId(buf: Buffer): string {
  // Fingerprint; not a secret. Lets us detect "which key encrypted this"
  // without storing the key material in the row.
  return buf.subarray(0, 4).toString("hex");
}

function currentKey(): { kid: string; key: Buffer } {
  const k = parseKey(env.FIELD_ENCRYPTION_KEY);
  if (!k) {
    throw new AppError(
      "unavailable",
      "FIELD_ENCRYPTION_KEY is missing or not 32 bytes of base64"
    );
  }
  return { kid: keyId(k), key: k };
}

function previousKey(): { kid: string; key: Buffer } | null {
  const k = parseKey(env.FIELD_ENCRYPTION_KEY_PREV);
  if (!k) return null;
  return { kid: keyId(k), key: k };
}

export function encryptField(plaintext: string): EncryptedField {
  const { kid, key } = currentKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    kid,
    iv: iv.toString("base64"),
    ct: ct.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptField(blob: EncryptedField): string {
  if (!blob || blob.v !== 1) throw new AppError("internal_error", "unknown ciphertext version");
  const candidates: Array<{ kid: string; key: Buffer }> = [];
  const cur = currentKey();
  candidates.push(cur);
  const prev = previousKey();
  if (prev) candidates.push(prev);
  const matching = candidates.find((c) => c.kid === blob.kid);
  const toTry = matching ? [matching] : candidates;
  let lastErr: Error | null = null;
  for (const { key } of toTry) {
    try {
      const iv = Buffer.from(blob.iv, "base64");
      const ct = Buffer.from(blob.ct, "base64");
      const tag = Buffer.from(blob.tag, "base64");
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
      return pt.toString("utf8");
    } catch (err) {
      lastErr = err as Error;
    }
  }
  throw new AppError("internal_error", `ciphertext could not be decrypted (${lastErr?.message ?? "unknown"})`);
}

// Returns a stable, non-reversible SHA-256 of the normalized plaintext, so
// we can index/search beneficiary names without decrypting every row. The
// mapping is per-key (uses the current key as HMAC key) so rotation
// invalidates the index too; the service rebuilds it on write.
export function fieldFingerprint(plaintext: string): string {
  const { key } = currentKey();
  const hmac = require("node:crypto").createHmac("sha256", key);
  hmac.update(plaintext.trim().toLowerCase());
  return (hmac.digest("hex") as string).slice(0, 32);
}

// Generate a key, printed by the CLI helper. Not used at runtime.
export function generateKeyBase64(): string {
  return randomBytes(32).toString("base64");
}
