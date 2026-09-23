import { describe, expect, it } from "vitest";
import {
  buildCheckoutLineItems,
  buildTaxCalculationLineItems,
  buildTaxReversalLineItems,
  decideTaxTreatment,
  extractTaxLinesFromCalculation,
  getIpCountryFromRequest,
  normalizeTaxCountry,
  parseTaxConfig,
} from "../tax.js";

const allCodes = {
  STRIPE_TAX_CODE_BASE: "txcd_base",
  STRIPE_TAX_CODE_BUYER_FEE: "txcd_fee",
  STRIPE_TAX_CODE_TIP: "txcd_tip",
  STRIPE_TAX_CODE_SUPPORT: "txcd_support",
};

describe("parseTaxConfig", () => {
  it("collects nowhere by default -- the advice gate is open", () => {
    const config = parseTaxConfig({});

    expect(config.collectionCountries.size).toBe(0);
    expect(config.configError).toBeNull();
    expect(decideTaxTreatment("GB", config)).toBe("not_collected");
    expect(decideTaxTreatment("CA", config)).toBe("not_collected");
  });

  it("fails closed when a country is enabled without every line's tax code", () => {
    const config = parseTaxConfig({
      STRIPE_TAX_COLLECTION_COUNTRIES: "GB",
      STRIPE_TAX_CODE_BASE: "txcd_base",
    });

    expect(config.configError).toMatch(/STRIPE_TAX_CODE_BUYER_FEE/);
    expect(config.configError).toMatch(/STRIPE_TAX_CODE_TIP/);
    expect(config.configError).toMatch(/STRIPE_TAX_CODE_SUPPORT/);
  });

  it("collects only in the listed countries once fully configured", () => {
    const config = parseTaxConfig({
      ...allCodes,
      STRIPE_TAX_COLLECTION_COUNTRIES: " gb, ie ,,xx",
    });

    expect(config.configError).toBeNull();
    expect([...config.collectionCountries].sort()).toEqual(["GB", "IE"]);
    expect(decideTaxTreatment("GB", config)).toBe("calculated");
    expect(decideTaxTreatment("FR", config)).toBe("not_collected");
  });
});

describe("normalizeTaxCountry / getIpCountryFromRequest", () => {
  it("accepts ISO codes and rejects placeholders", () => {
    expect(normalizeTaxCountry(" gb ")).toBe("GB");
    expect(normalizeTaxCountry("XX")).toBeNull();
    expect(normalizeTaxCountry("T1")).toBeNull();
    expect(normalizeTaxCountry("GBR")).toBeNull();
    expect(normalizeTaxCountry(null)).toBeNull();
  });

  it("reads the configured header only", () => {
    const req = { get: (name) => (name === "cf-ipcountry" ? "de" : undefined) };

    expect(getIpCountryFromRequest(req, "cf-ipcountry")).toBe("DE");
    expect(getIpCountryFromRequest(req, null)).toBeNull();
    expect(getIpCountryFromRequest(req, "x-other")).toBeNull();
  });
});

const payment = {
  currency: "gbp",
  base_amount_cents: 10000,
  buyer_service_fee_cents: 500,
  creator_tip_cents: 0,
  platform_support_cents: 300,
};

describe("buildTaxCalculationLineItems", () => {
  it("sends one tax-exclusive line per non-zero component, with its configured code", () => {
    const { taxCodes } = parseTaxConfig(allCodes);

    expect(buildTaxCalculationLineItems(payment, taxCodes)).toEqual([
      { amount: 10000, reference: "base", tax_behavior: "exclusive", tax_code: "txcd_base" },
      { amount: 500, reference: "buyer_service_fee", tax_behavior: "exclusive", tax_code: "txcd_fee" },
      { amount: 300, reference: "platform_support", tax_behavior: "exclusive", tax_code: "txcd_support" },
    ]);
  });
});

describe("extractTaxLinesFromCalculation", () => {
  const calculation = {
    tax_amount_exclusive: 2160,
    customer_details: { address: { country: "GB", state: null } },
    line_items: {
      has_more: false,
      data: [
        { reference: "base", amount_tax: 2000 },
        { reference: "buyer_service_fee", amount_tax: 100 },
        { reference: "platform_support", amount_tax: 60 },
      ],
    },
  };

  it("maps per-line tax back onto the ledger columns", () => {
    expect(extractTaxLinesFromCalculation(calculation)).toEqual({
      tax_on_base_cents: 2000,
      tax_on_buyer_fee_cents: 100,
      tax_on_tip_cents: 0,
      tax_on_support_cents: 60,
      jurisdictionRegion: null,
    });
  });

  it("refuses a calculation whose lines do not add up to Stripe's own total", () => {
    expect(() =>
      extractTaxLinesFromCalculation({ ...calculation, tax_amount_exclusive: 2161 }),
    ).toThrow(/does not match/);
  });

  it("refuses an unexpected line", () => {
    expect(() =>
      extractTaxLinesFromCalculation({
        ...calculation,
        line_items: { has_more: false, data: [{ reference: "mystery", amount_tax: 1 }] },
      }),
    ).toThrow(/unexpected line/);
  });
});

describe("buildCheckoutLineItems", () => {
  it("shows tax as its own line and adds up to the stored total", () => {
    const lines = buildCheckoutLineItems({
      payment: {
        ...payment,
        tax_cents: 2160,
        tax_jurisdiction_country: "GB",
        tax_jurisdiction_region: null,
        total_checkout_cents: 10000 + 500 + 300 + 2160,
      },
      title: "Starting payment",
      metadata: {},
    });

    expect(lines.map((line) => [line.price_data.product_data.name, line.price_data.unit_amount])).toEqual([
      ["Starting payment", 10000],
      ["Buyer service fee", 500],
      ["Made for Stream support", 300],
      ["Tax (GB)", 2160],
    ]);
  });

  it("throws rather than charge an amount that differs from the stored total", () => {
    expect(() =>
      buildCheckoutLineItems({
        payment: { ...payment, tax_cents: 0, total_checkout_cents: 99999 },
        title: "x",
        metadata: {},
      }),
    ).toThrow(/do not add up/);
  });
});

describe("buildTaxReversalLineItems", () => {
  it("reverses each refunded line against the original transaction line, negatively", () => {
    const original = [
      { id: "tax_li_base", reference: "base" },
      { id: "tax_li_fee", reference: "buyer_service_fee" },
      { id: "tax_li_support", reference: "platform_support" },
    ];

    expect(
      buildTaxReversalLineItems(original, {
        baseRefundCents: 2500,
        thisBuyerFeeRefund: 125,
        tipRefundCents: 0,
        contributionRefundCents: 0,
        thisBaseTaxRefund: 500,
        thisBuyerFeeTaxRefund: 25,
        thisTipTaxRefund: 0,
        thisSupportTaxRefund: 0,
      }),
    ).toEqual([
      { original_line_item: "tax_li_base", reference: "base_refund", amount: -2500, amount_tax: -500 },
      { original_line_item: "tax_li_fee", reference: "buyer_service_fee_refund", amount: -125, amount_tax: -25 },
    ]);
  });

  it("throws when a refunded line has no original to reverse", () => {
    expect(() =>
      buildTaxReversalLineItems([], {
        baseRefundCents: 1,
        thisBuyerFeeRefund: 0,
        tipRefundCents: 0,
        contributionRefundCents: 0,
        thisBaseTaxRefund: 0,
        thisBuyerFeeTaxRefund: 0,
        thisTipTaxRefund: 0,
        thisSupportTaxRefund: 0,
      }),
    ).toThrow(/no "base" line/);
  });
});
