import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "@/config/env.js";
import { AppError } from "@/util/errors.js";
import type { EncryptedBlob } from "@/models/SocialConnection.js";

// =============================================================================
// AES-256-GCM for OAuth tokens. Shape identical to the beneficiary blob so
// the two subsystems can share operational conventions (same key rotation
// playbook, same monitoring). The KEY material is deliberately separate —
// a compromise of social keys never grants beneficiary access.
// =============================================================================

function parseKey(raw: string | undefined): Buffer | null {
  if (!raw) return null;
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) return null;
  return buf;
}

function keyId(buf: Buffer): string {
  return buf.subarray(0, 4).toString("hex");
}

function currentKey(): { kid: string; key: Buffer } {
  const k = parseKey(env.SOCIAL_TOKEN_KEY);
  if (!k) {
    throw new AppError("unavailable", "SOCIAL_TOKEN_KEY is missing or not 32 bytes of base64");
  }
  return { kid: keyId(k), key: k };
}

function previousKey(): { kid: string; key: Buffer } | null {
  const k = parseKey(env.SOCIAL_TOKEN_KEY_PREV);
  if (!k) return null;
  return { kid: keyId(k), key: k };
}

export function encryptToken(plaintext: string): EncryptedBlob {
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

export function decryptToken(blob: EncryptedBlob): string {
  const candidates: Array<{ kid: string; key: Buffer }> = [currentKey()];
  const prev = previousKey();
  if (prev) candidates.push(prev);
  const matching = candidates.find((c) => c.kid === blob.kid);
  const toTry = matching ? [matching] : candidates;
  for (const { key } of toTry) {
    try {
      const iv = Buffer.from(blob.iv, "base64");
      const ct = Buffer.from(blob.ct, "base64");
      const tag = Buffer.from(blob.tag, "base64");
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
    } catch {
      // Try the next candidate.
    }
  }
  throw new AppError("internal_error", "social token could not be decrypted");
}

export function generateKeyBase64(): string {
  return randomBytes(32).toString("base64");
}
