import mongoose from "mongoose";

// =============================================================================
// Money (§9.4). Amounts are stored as 64-bit integers in the smallest unit of
// their currency (cents for USD, UGX whole-shillings for UGX). Mongoose does
// NOT support BigInt natively on save; serialising a JS BigInt through the
// default int32 path silently truncates values above ~2.1e9. To keep money as
// true int64 end-to-end we store it as BSON `Long` and expose a BigInt API.
//
// Any ledger field in a schema MUST use `MoneyLongSchemaType` and be validated
// as "long" by the collection validator (migration applies `bsonType: "long"`).
// `money.test.ts` fails the build if a large value drifts through a double.
// =============================================================================

import { Long } from "mongodb";

export type Money = bigint;

export const MAX_INT64 = 9_223_372_036_854_775_807n;
export const MIN_INT64 = -9_223_372_036_854_775_808n;

export function toMoney(input: number | string | bigint): Money {
  if (typeof input === "bigint") return input;
  if (typeof input === "number") {
    if (!Number.isFinite(input) || Math.trunc(input) !== input) {
      throw new Error("money: not an integer");
    }
    return BigInt(input);
  }
  if (!/^-?\d+$/.test(input)) throw new Error("money: not an integer string");
  return BigInt(input);
}

export function fromMoney(v: Money): string {
  return v.toString(10);
}

// Addition / subtraction over Money (BigInt), with range checks.
export function moneyAdd(a: Money, b: Money): Money {
  const r = a + b;
  if (r > MAX_INT64 || r < MIN_INT64) throw new Error("money: overflow");
  return r;
}
export function moneySub(a: Money, b: Money): Money {
  return moneyAdd(a, -b);
}

// Mongoose SchemaType that stores a BSON Long and surfaces it as BigInt on
// documents. Required for every amount field in a ledger-adjacent schema.
export class MoneyLong extends mongoose.SchemaType {
  constructor(key: string, options?: mongoose.SchemaTypeOptions<unknown>) {
    super(key, options as never, "MoneyLong");
  }
  override cast(val: unknown): Long {
    if (val instanceof Long) return val;
    if (typeof val === "bigint") {
      if (val > MAX_INT64 || val < MIN_INT64) throw new Error("money: overflow");
      return Long.fromBigInt(val);
    }
    if (typeof val === "number") {
      if (!Number.isFinite(val) || Math.trunc(val) !== val) {
        throw new Error("money: expected integer, got non-integer number");
      }
      if (!Number.isSafeInteger(val)) {
        // >2^53 can't survive a round-trip as a JS number — refuse so the
        // caller passes a BigInt or string instead.
        throw new Error("money: value exceeds Number.MAX_SAFE_INTEGER; use BigInt");
      }
      return Long.fromNumber(val);
    }
    if (typeof val === "string") {
      if (!/^-?\d+$/.test(val)) throw new Error("money: not an integer string");
      return Long.fromString(val);
    }
    throw new Error("money: unsupported type " + typeof val);
  }
}

// Register with mongoose so it can be referenced by `type: MoneyLong`.
(mongoose.Schema.Types as unknown as Record<string, unknown>).MoneyLong = MoneyLong;
