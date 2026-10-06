import { describe, it, expect, beforeEach } from "vitest";
// Import setup.ts for its side-effect of priming the env with placeholders —
// vi.resetModules() otherwise wipes it and env.ts bails on load.
import "./setup.js";
import { generateKeyBase64 } from "../src/beneficiary/crypto.js";

// =============================================================================
// Pure crypto tests — can run without a database.
// We can't just `import` the crypto module once because the environment
// variable it reads is captured on first import; so we re-import it per
// test via `vi.resetModules`.
// =============================================================================

async function withKeys<T>(
  env: { FIELD_ENCRYPTION_KEY?: string; FIELD_ENCRYPTION_KEY_PREV?: string },
  fn: (mod: typeof import("../src/beneficiary/crypto.js")) => Promise<T> | T
): Promise<T> {
  const prevA = process.env.FIELD_ENCRYPTION_KEY;
  const prevB = process.env.FIELD_ENCRYPTION_KEY_PREV;
  process.env.FIELD_ENCRYPTION_KEY = env.FIELD_ENCRYPTION_KEY ?? generateKeyBase64();
  if (env.FIELD_ENCRYPTION_KEY_PREV) {
    process.env.FIELD_ENCRYPTION_KEY_PREV = env.FIELD_ENCRYPTION_KEY_PREV;
  } else {
    delete process.env.FIELD_ENCRYPTION_KEY_PREV;
  }
  const { setProviderForTests } = await import("../src/services/ai/provider.js");
  setProviderForTests(null);
  const vitest = await import("vitest");
  vitest.vi.resetModules();
  const envMod = await import("../src/config/env.js");
  // The env module caches at import time; vitest.resetModules re-evaluates
  // it. The subsequent dynamic import of crypto.ts sees the fresh env.
  void envMod;
  const mod = await import("../src/beneficiary/crypto.js");
  try {
    return await fn(mod);
  } finally {
    if (prevA) process.env.FIELD_ENCRYPTION_KEY = prevA;
    else delete process.env.FIELD_ENCRYPTION_KEY;
    if (prevB) process.env.FIELD_ENCRYPTION_KEY_PREV = prevB;
    else delete process.env.FIELD_ENCRYPTION_KEY_PREV;
  }
}

describe("field encryption", () => {
  it("round-trips a name", async () => {
    await withKeys({ FIELD_ENCRYPTION_KEY: generateKeyBase64() }, (m) => {
      const ct = m.encryptField("Mary Namusoke");
      expect(ct.ct).not.toContain("Mary");
      expect(m.decryptField(ct)).toBe("Mary Namusoke");
    });
  });

  it("different IVs for identical plaintext (no ECB-style leakage)", async () => {
    await withKeys({ FIELD_ENCRYPTION_KEY: generateKeyBase64() }, (m) => {
      const a = m.encryptField("hello");
      const b = m.encryptField("hello");
      expect(a.iv).not.toBe(b.iv);
      expect(a.ct).not.toBe(b.ct);
    });
  });

  it("fingerprint is stable for the same name under the same key", async () => {
    const key = generateKeyBase64();
    await withKeys({ FIELD_ENCRYPTION_KEY: key }, (m) => {
      expect(m.fieldFingerprint("Mary Namusoke")).toBe(m.fieldFingerprint("mary namusoke  "));
    });
  });

  it("fingerprint changes under a different key", async () => {
    const k1 = generateKeyBase64();
    const k2 = generateKeyBase64();
    const f1 = await withKeys({ FIELD_ENCRYPTION_KEY: k1 }, (m) => m.fieldFingerprint("Mary Namusoke"));
    const f2 = await withKeys({ FIELD_ENCRYPTION_KEY: k2 }, (m) => m.fieldFingerprint("Mary Namusoke"));
    expect(f1).not.toBe(f2);
  });

  it("decrypts ciphertext written under the previous key after rotation", async () => {
    const oldKey = generateKeyBase64();
    const encrypted = await withKeys({ FIELD_ENCRYPTION_KEY: oldKey }, (m) =>
      m.encryptField("Mary Namusoke")
    );
    const newKey = generateKeyBase64();
    const decrypted = await withKeys(
      { FIELD_ENCRYPTION_KEY: newKey, FIELD_ENCRYPTION_KEY_PREV: oldKey },
      (m) => m.decryptField(encrypted)
    );
    expect(decrypted).toBe("Mary Namusoke");
  });

  it("refuses a tampered ciphertext (auth tag mismatch)", async () => {
    await withKeys({ FIELD_ENCRYPTION_KEY: generateKeyBase64() }, (m) => {
      const ct = m.encryptField("Mary Namusoke");
      const tampered = { ...ct, ct: Buffer.from(ct.ct, "base64").reverse().toString("base64") };
      expect(() => m.decryptField(tampered)).toThrow();
    });
  });

  it("refuses to encrypt when the key is missing", async () => {
    const prev = process.env.FIELD_ENCRYPTION_KEY;
    delete process.env.FIELD_ENCRYPTION_KEY;
    const vitest = await import("vitest");
    vitest.vi.resetModules();
    const envMod = await import("../src/config/env.js");
    void envMod;
    const m = await import("../src/beneficiary/crypto.js");
    expect(() => m.encryptField("x")).toThrow(/FIELD_ENCRYPTION_KEY/);
    if (prev) process.env.FIELD_ENCRYPTION_KEY = prev;
  });
});

beforeEach(() => {
  // Keep tests independent of each other's env mutations.
});
