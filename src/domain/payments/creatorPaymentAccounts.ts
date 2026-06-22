export type CreatorPaymentProvider = "stripe";

export type CreatorPaymentAccountReadinessInput = {
  provider?: string | null;
  charges_enabled?: boolean | null;
  payouts_enabled?: boolean | null;
  details_submitted?: boolean | null;
  country?: string | null;
  default_currency?: string | null;
};

export const getNormalisedCreatorPaymentCountry = (
  country?: string | null,
): string => country?.trim().toUpperCase() ?? "";

export const getNormalisedCreatorPaymentCurrency = (
  currency?: string | null,
): string => currency?.trim().toLowerCase() ?? "";

export const isValidCreatorPaymentCountryCode = (
  country?: string | null,
): boolean => /^[A-Z]{2}$/.test(getNormalisedCreatorPaymentCountry(country));

export const isValidCreatorPaymentCurrencyCode = (
  currency?: string | null,
): boolean => /^[a-z]{3}$/.test(getNormalisedCreatorPaymentCurrency(currency));

export const getCreatorPaymentAccountReadinessBlocker = (
  account?: CreatorPaymentAccountReadinessInput | null,
): string | null => {
  if (!account || account.provider !== "stripe") {
    return "Connect a Stripe account before publishing paid listings.";
  }

  if (!isValidCreatorPaymentCountryCode(account.country)) {
    return "Stripe account country must be a two-letter country code.";
  }

  if (!isValidCreatorPaymentCurrencyCode(account.default_currency)) {
    return "Stripe account currency must be a three-letter currency code.";
  }

  if (!account.details_submitted) {
    return "Finish Stripe onboarding before publishing paid listings.";
  }

  if (!account.charges_enabled) {
    return "Stripe must finish enabling charges for this creator account.";
  }

  if (!account.payouts_enabled) {
    return "Stripe must finish enabling payouts for this creator account.";
  }

  return null;
};

export const isCreatorPaymentAccountReady = (
  account?: CreatorPaymentAccountReadinessInput | null,
): boolean => getCreatorPaymentAccountReadinessBlocker(account) === null;