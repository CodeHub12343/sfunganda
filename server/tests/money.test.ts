import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { Long } from "mongodb";
import { startTestDB, stopTestDB } from "./setup.js";
import { MoneyLong } from "../src/util/money.js";

// =============================================================================
// Money (int64) regression test — before any finance code is written.
// If a schema accidentally stores a USD amount as a JS double, we silently
// lose integer precision above 2^53 cents (~$90 trillion). This test writes
// a true int64 through MoneyLong and confirms the round-trip is bit-for-bit
// exact — using a value Number cannot represent as an integer.
// =============================================================================

const Schema = new mongoose.Schema({
  // NB: pass `type: MoneyLong` directly (SchemaTypeOptions).
  amount: { type: MoneyLong, required: true },
});

const AmountDoc = mongoose.model("MoneyTestDoc", Schema, "money_test");

describe("money (int64 round-trip)", () => {
  beforeAll(async () => {
    await startTestDB();
  });
  afterAll(async () => {
    await stopTestDB();
  });

  it("round-trips a value larger than Number.MAX_SAFE_INTEGER", async () => {
    const big = 9_000_000_000_000_000_123n; // > 2^53
    expect(Number.isSafeInteger(Number(big))).toBe(false);
    const doc = await AmountDoc.create({ amount: big });

    const raw = await mongoose.connection.db!.collection("money_test").findOne({ _id: doc._id });
    expect(raw).not.toBeNull();
    const amt = (raw as unknown as { amount: unknown }).amount;
    expect(amt).toBeInstanceOf(Long);
    expect((amt as Long).toBigInt()).toBe(big);
  });

  it("refuses an unsafe Number input", async () => {
    const unsafe = 2 ** 53 + 1; // not a safe integer
    expect(() => AmountDoc.hydrate({ amount: unsafe })).toThrow();
  });

  it("refuses a non-integer number", async () => {
    expect(() => AmountDoc.hydrate({ amount: 10.5 })).toThrow();
  });
});
