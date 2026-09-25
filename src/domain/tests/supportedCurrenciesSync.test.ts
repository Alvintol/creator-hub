import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  MINIMUM_INSTALMENT_MINOR_UNITS,
  SUPPORTED_CURRENCY_CODES,
  getInstalmentFloorMessage,
  isSupportedCurrency,
} from "../payments/supportedCurrencies";
import * as api from "../../../api/supportedCurrencies.js";

// Three copies of one list: the database seed (which enforces it), the API
// and the web app. This keeps all three from drifting.
const migrationSeed = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260923_138_add_supported_currencies_instalment_floor_and_early_start_consent.sql",
  ),
  "utf8",
);

const seededRows = [...migrationSeed.matchAll(/\('([a-z]{3})', (\d+), true\)/g)].map(
  ([, code, floor]) => ({ code, floor: Number(floor) }),
);

describe("supported currencies stay in sync", () => {
  it("lists the same currencies in the API and the web app", () => {
    expect([...api.SUPPORTED_CURRENCY_CODES].sort()).toEqual([...SUPPORTED_CURRENCY_CODES].sort());
    expect(api.MINIMUM_INSTALMENT_MINOR_UNITS).toBe(MINIMUM_INSTALMENT_MINOR_UNITS);
  });

  it("matches the enabled rows seeded by migration 138", () => {
    expect(seededRows.map((row) => row.code).sort()).toEqual([...SUPPORTED_CURRENCY_CODES].sort());
    expect(new Set(seededRows.map((row) => row.floor))).toEqual(
      new Set([MINIMUM_INSTALMENT_MINOR_UNITS]),
    );
  });

  it("uses the same refusal message on both sides", () => {
    expect(api.getUnsupportedCurrencyMessage("jpy")).toBe(getInstalmentFloorMessage(50, "jpy"));
  });
});

describe("getInstalmentFloorMessage", () => {
  it("accepts a payment at the floor", () => {
    expect(getInstalmentFloorMessage(10, "cad")).toBeNull();
    expect(getInstalmentFloorMessage(10, "EUR")).toBeNull();
  });

  it("refuses a payment below the floor with the amount and what to do", () => {
    expect(getInstalmentFloorMessage(9.99, "gbp")).toBe(
      "Each payment in a project must be at least 10.00 GBP, and this one is 9.99 GBP. Combine it with another payment or raise its amount.",
    );
  });

  it("refuses zero- and three-decimal currencies until the exponent work lands", () => {
    expect(isSupportedCurrency("jpy")).toBe(false);
    expect(isSupportedCurrency("kwd")).toBe(false);
    expect(getInstalmentFloorMessage(1000, "jpy")).toMatch(/^Payments in JPY are not supported yet/);
  });
});
