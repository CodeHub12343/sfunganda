import { describe, it, expect } from "vitest";
import "./setup.js";
import { generateKeyBase64 } from "../src/services/socialTokens.js";

async function withKeys<T>(
  env: { SOCIAL_TOKEN_KEY?: string; SOCIAL_TOKEN_KEY_PREV?: string },
  fn: (mod: typeof import("../src/services/socialTokens.js")) => Promise<T> | T
): Promise<T> {
  const prevA = process.env.SOCIAL_TOKEN_KEY;
  const prevB = process.env.SOCIAL_TOKEN_KEY_PREV;
  process.env.SOCIAL_TOKEN_KEY = env.SOCIAL_TOKEN_KEY ?? generateKeyBase64();
  if (env.SOCIAL_TOKEN_KEY_PREV) {
    process.env.SOCIAL_TOKEN_KEY_PREV = env.SOCIAL_TOKEN_KEY_PREV;
  } else {
    delete process.env.SOCIAL_TOKEN_KEY_PREV;
  }
  const vitest = await import("vitest");
  vitest.vi.resetModules();
  await import("../src/config/env.js");
  const mod = await import("../src/services/socialTokens.js");
  try {
    return await fn(mod);
  } finally {
    if (prevA) process.env.SOCIAL_TOKEN_KEY = prevA;
    else delete process.env.SOCIAL_TOKEN_KEY;
    if (prevB) process.env.SOCIAL_TOKEN_KEY_PREV = prevB;
    else delete process.env.SOCIAL_TOKEN_KEY_PREV;
  }
}

describe("social token encryption", () => {
  it("round-trips a refresh token", async () => {
    await withKeys({ SOCIAL_TOKEN_KEY: generateKeyBase64() }, (m) => {
      const ct = m.encryptToken("1//abc.secret");
      expect(ct.ct).not.toContain("secret");
      expect(m.decryptToken(ct)).toBe("1//abc.secret");
    });
  });
  it("decrypts tokens written under the previous key after rotation", async () => {
    const oldKey = generateKeyBase64();
    const blob = await withKeys({ SOCIAL_TOKEN_KEY: oldKey }, (m) => m.encryptToken("old-token"));
    const newKey = generateKeyBase64();
    const pt = await withKeys(
      { SOCIAL_TOKEN_KEY: newKey, SOCIAL_TOKEN_KEY_PREV: oldKey },
      (m) => m.decryptToken(blob)
    );
    expect(pt).toBe("old-token");
  });
  it("rejects a tampered ciphertext (auth tag)", async () => {
    await withKeys({ SOCIAL_TOKEN_KEY: generateKeyBase64() }, (m) => {
      const ct = m.encryptToken("token");
      const bad = { ...ct, ct: Buffer.from(ct.ct, "base64").reverse().toString("base64") };
      expect(() => m.decryptToken(bad)).toThrow();
    });
  });
});
