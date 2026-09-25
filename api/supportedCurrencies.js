// The currencies a project may be priced in, and the instalment floor in each,
// mirroring public.supported_currencies (20260923_138) and
// src/domain/payments/supportedCurrencies.ts.
//
// KEEP IN SYNC BY HAND, like policyVersions.js: this plain-JS API has no build
// step connecting it to the TypeScript app.
// src/domain/tests/supportedCurrenciesSync.test.ts fails the moment the two
// code copies disagree; the migration's seed must be changed alongside them.
//
// Every entry is two-decimal. The payment bridge still converts with `* 100`,
// so a zero- or three-decimal currency cannot be added here until that is
// fixed (launch-scope.md section 1.1). Being listed is not the same as being
// cleared for live sales: see docs/support/payments/tax.md for the tax gate.

export const MINIMUM_INSTALMENT_MINOR_UNITS = 1000;

export const SUPPORTED_CURRENCY_CODES = [
  "cad",
  "usd",
  "eur",
  "gbp",
  "aud",
  "nzd",
  "chf",
  "sgd",
  "sek",
  "nok",
  "dkk",
  "pln",
  "mxn",
  "brl",
  "hkd",
];

export const isSupportedCurrency = (value) =>
  SUPPORTED_CURRENCY_CODES.includes(String(value || "").trim().toLowerCase());

export const getUnsupportedCurrencyMessage = (value) =>
  `Payments in ${String(value || "(none)").trim().toUpperCase()} are not supported yet. Price the project in a currency listed in the Fee Schedule.`;
