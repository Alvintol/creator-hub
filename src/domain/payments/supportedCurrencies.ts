// The currencies a project may be priced in, and the instalment floor in each.
// Mirrors public.supported_currencies (20260923_138), which is what actually
// enforces both; this copy exists so forms can say so before the database
// refuses. api/supportedCurrencies.js keeps its own copy, and
// supportedCurrenciesSync.test.ts keeps the two aligned.
//
// All two-decimal: the payment bridge still converts with `* 100`
// (launch-scope.md section 1.1).

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
] as const;

export type SupportedCurrencyCode = (typeof SUPPORTED_CURRENCY_CODES)[number];

export const isSupportedCurrency = (value: string): value is SupportedCurrencyCode =>
  (SUPPORTED_CURRENCY_CODES as readonly string[]).includes(value.trim().toLowerCase());

// The floor in major units, e.g. 10 for 10.00.
export const minimumInstalmentAmount = MINIMUM_INSTALMENT_MINOR_UNITS / 100;

// Same wording as public.assert_listing_request_instalment_allowed, so a
// form's message and the database's refusal read alike.
export const getInstalmentFloorMessage = (amount: number, currency: string): string | null => {
  const code = currency.trim().toUpperCase();

  if (!isSupportedCurrency(currency)) {
    return `Payments in ${code || "(none)"} are not supported yet. Price the project in a currency listed in the Fee Schedule.`;
  }

  if (Math.round(amount * 100) < MINIMUM_INSTALMENT_MINOR_UNITS) {
    return `Each payment in a project must be at least ${minimumInstalmentAmount.toFixed(2)} ${code}, and this one is ${amount.toFixed(2)} ${code}. Combine it with another payment or raise its amount.`;
  }

  return null;
};
