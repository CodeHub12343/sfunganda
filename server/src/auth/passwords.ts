import argon2 from "argon2";

// Argon2id — modern default. Parameters chosen for a ~250ms hash on a small
// cloud box; tune in production if that budget is wrong.
const OPTS = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < 12) throw new Error("password must be at least 12 characters");
  if (plain.length > 1024) throw new Error("password too long");
  return argon2.hash(plain, OPTS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  if (!hash || !plain) return false;
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
