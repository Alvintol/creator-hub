import { describe, expect, it } from "vitest";
import {
  getCreatorPaymentAccountReadinessBlocker,
  getNormalisedCreatorPaymentCountry,
  getNormalisedCreatorPaymentCurrency,
  isCreatorPaymentAccountReady,
  isValidCreatorPaymentCountryCode,
  isValidCreatorPaymentCurrencyCode,
} from "../payments/creatorPaymentAccounts";

const readyAccount = {
  provider: "stripe",
  charges_enabled: true,
  payouts_enabled: true,
  details_submitted: true,
  country: "CA",
  default_currency: "cad",
};

describe("creator payment accounts", () => {
  it("normalises country and currency values", () => {
    expect(getNormalisedCreatorPaymentCountry(" ca ")).toBe("CA");
    expect(getNormalisedCreatorPaymentCurrency(" CAD ")).toBe("cad");
  });

  it("accepts flexible two-letter country codes", () => {
    expect(isValidCreatorPaymentCountryCode("CA")).toBe(true);
    expect(isValidCreatorPaymentCountryCode("us")).toBe(true);
    expect(isValidCreatorPaymentCountryCode("GB")).toBe(true);
    expect(isValidCreatorPaymentCountryCode("JP")).toBe(true);
    expect(isValidCreatorPaymentCountryCode("CAN")).toBe(false);
    expect(isValidCreatorPaymentCountryCode("")).toBe(false);
  });

  it("accepts flexible three-letter currency codes", () => {
    expect(isValidCreatorPaymentCurrencyCode("cad")).toBe(true);
    expect(isValidCreatorPaymentCurrencyCode("USD")).toBe(true);
    expect(isValidCreatorPaymentCurrencyCode("gbp")).toBe(true);
    expect(isValidCreatorPaymentCurrencyCode("jpy")).toBe(true);
    expect(isValidCreatorPaymentCurrencyCode("us")).toBe(false);
    expect(isValidCreatorPaymentCurrencyCode("")).toBe(false);
  });

  it("blocks paid listing publishing without a Stripe account", () => {
    expect(isCreatorPaymentAccountReady(null)).toBe(false);
    expect(getCreatorPaymentAccountReadinessBlocker(null)).toBe(
      "Connect a Stripe account before publishing paid listings.",
    );
  });

  it("requires a valid Stripe account country code", () => {
    expect(
      getCreatorPaymentAccountReadinessBlocker({
        ...readyAccount,
        country: "Canada",
      }),
    ).toBe("Stripe account country must be a two-letter country code.");
  });

  it("requires a valid Stripe account currency code", () => {
    expect(
      getCreatorPaymentAccountReadinessBlocker({
        ...readyAccount,
        default_currency: "dollars",
      }),
    ).toBe("Stripe account currency must be a three-letter currency code.");
  });

  it("requires completed Stripe onboarding", () => {
    expect(
      getCreatorPaymentAccountReadinessBlocker({
        ...readyAccount,
        details_submitted: false,
      }),
    ).toBe("Finish Stripe onboarding before publishing paid listings.");
  });

  it("requires charges to be enabled", () => {
    expect(
      getCreatorPaymentAccountReadinessBlocker({
        ...readyAccount,
        charges_enabled: false,
      }),
    ).toBe("Stripe must finish enabling charges for this creator account.");
  });

  it("requires payouts to be enabled", () => {
    expect(
      getCreatorPaymentAccountReadinessBlocker({
        ...readyAccount,
        payouts_enabled: false,
      }),
    ).toBe("Stripe must finish enabling payouts for this creator account.");
  });

  it("allows ready Stripe accounts across currencies", () => {
    expect(isCreatorPaymentAccountReady(readyAccount)).toBe(true);
    expect(
      isCreatorPaymentAccountReady({
        ...readyAccount,
        country: "JP",
        default_currency: "jpy",
      }),
    ).toBe(true);
    expect(
      isCreatorPaymentAccountReady({
        ...readyAccount,
        country: "DE",
        default_currency: "eur",
      }),
    ).toBe(true);
  });
});