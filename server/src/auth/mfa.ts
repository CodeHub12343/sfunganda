import { authenticator } from "otplib";
import QRCode from "qrcode";
import crypto from "node:crypto";
import { env } from "@/config/env.js";

authenticator.options = { step: 30, window: 1 };

export function generateSecret(): string {
  return authenticator.generateSecret();
}

export function otpauthURL(secret: string, account: string): string {
  return authenticator.keyuri(account, env.MFA_ISSUER, secret);
}

export async function otpauthQRCodeDataURL(secret: string, account: string): Promise<string> {
  return QRCode.toDataURL(otpauthURL(secret, account));
}

export function verifyTOTP(secret: string, token: string): boolean {
  if (!/^\d{6}$/.test(token)) return false;
  return authenticator.check(token, secret);
}

export function generateRecoveryCodes(count = 10): { codes: string[]; hashes: string[] } {
  const codes: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(5).toString("hex"); // 10 hex chars
    codes.push(raw);
    hashes.push(sha256(raw));
  }
  return { codes, hashes };
}

export function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}
