// Sprint 7 (launch-scope.md section 12): regional sales tax helpers for
// api/server.js, kept free of Stripe/Supabase/env wiring so they are
// directly unit-testable (api/tests/tax.test.js) -- the same reason
// refundArithmetic.js and policyVersions.js exist as separate files.
//
// Charge model (the decision recorded in docs/launch-implementation-checklist.md,
// Sprint 7): commission payments remain direct charges on the creator's
// connected account, and Stripe Tax does not support platform tax liability
// on direct charges. So tax is calculated with the Stripe Tax Calculation
// API on the PLATFORM account, charged as its own Checkout line, swept to
// the platform inside application_fee_amount, and recorded as a Stripe Tax
// transaction on the platform account once paid.
//
// COLLECTION IS OFF BY DEFAULT. STRIPE_TAX_COLLECTION_COUNTRIES ships empty
// because which jurisdictions to register in -- and whether the buyer
// service fee, tip and contribution are separately taxable -- is the
// professional-advice gate in section 12.3, not an engineering decision.
// Nothing in this file assumes an answer: every line's tax code is config,
// and enabling any country without all four codes set is a hard error.

// Stable references for each taxable line. Used as the Stripe Tax line
// reference (so a later reversal can be matched to the original line) and
// to map a calculation's per-line tax back onto the ledger columns.
export const TAX_LINE_REFERENCES = {
  base: "base",
  buyerFee: "buyer_service_fee",
  tip: "creator_tip",
  support: "platform_support",
};

const TAX_CODE_ENV_KEYS = {
  base: "STRIPE_TAX_CODE_BASE",
  buyerFee: "STRIPE_TAX_CODE_BUYER_FEE",
  tip: "STRIPE_TAX_CODE_TIP",
  support: "STRIPE_TAX_CODE_SUPPORT",
};

/**
 * ISO 3166-1 alpha-2, uppercased, or null. Rejects Cloudflare's
 * placeholder codes ("XX" unknown, "T1" Tor) -- they are not evidence of
 * anywhere.
 * @param {unknown} value
 * @returns {string | null}
 */
export const normalizeTaxCountry = (value) => {
  const country = String(value ?? "").trim().toUpperCase();

  if (!/^[A-Z]{2}$/.test(country) || country === "XX" || country === "T1") {
    return null;
  }

  return country;
};

/**
 * @param {Record<string, string | undefined>} env
 */
export const parseTaxConfig = (env) => {
  const collectionCountries = new Set(
    String(env.STRIPE_TAX_COLLECTION_COUNTRIES || "")
      .split(",")
      .map((entry) => normalizeTaxCountry(entry))
      .filter(Boolean),
  );

  const taxCodes = Object.fromEntries(
    Object.entries(TAX_CODE_ENV_KEYS).map(([line, key]) => [
      line,
      String(env[key] || "").trim() || null,
    ]),
  );

  const missingTaxCodeKeys = Object.entries(TAX_CODE_ENV_KEYS)
    .filter(([line]) => !taxCodes[line])
    .map(([, key]) => key);

  return {
    collectionCountries,
    taxCodes,
    // Enabling any country without deciding every line's taxability would
    // silently pick an answer to the advice gate's third question. Fail
    // closed instead: checkout refuses until the config is complete.
    configError:
      collectionCountries.size > 0 && missingTaxCodeKeys.length > 0
        ? `Tax collection is enabled but ${missingTaxCodeKeys.join(", ")} ${missingTaxCodeKeys.length === 1 ? "is" : "are"} not set.`
        : null,
    ipCountryHeader:
      String(env.TAX_IP_COUNTRY_HEADER || "").trim().toLowerCase() || null,
  };
};

/**
 * @param {{ get?: (name: string) => string | undefined, headers?: Record<string, unknown> }} req
 * @param {string | null} headerName
 */
export const getIpCountryFromRequest = (req, headerName) => {
  if (!headerName) {
    return null;
  }

  const raw =
    typeof req.get === "function" ? req.get(headerName) : req.headers?.[headerName];

  return normalizeTaxCountry(Array.isArray(raw) ? raw[0] : raw);
};

/**
 * @param {string} billingCountry normalized
 * @param {ReturnType<typeof parseTaxConfig>} config
 * @returns {"calculated" | "not_collected"}
 */
export const decideTaxTreatment = (billingCountry, config) =>
  config.collectionCountries.has(billingCountry) ? "calculated" : "not_collected";

const paymentLines = (payment) => [
  { key: "base", amount: payment.base_amount_cents },
  { key: "buyerFee", amount: payment.buyer_service_fee_cents },
  { key: "tip", amount: payment.creator_tip_cents },
  { key: "support", amount: payment.platform_support_cents },
];

/**
 * Line items for stripe.tax.calculations.create. Zero-amount lines are
 * omitted; every amount is tax-exclusive (tax is added on top, shown as
 * its own line).
 */
export const buildTaxCalculationLineItems = (payment, taxCodes) =>
  paymentLines(payment)
    .filter((line) => line.amount > 0)
    .map((line) => ({
      amount: line.amount,
      reference: TAX_LINE_REFERENCES[line.key],
      tax_behavior: "exclusive",
      tax_code: taxCodes[line.key],
    }));

/**
 * Maps a Stripe Tax calculation (with line_items expanded) back onto the
 * ledger's per-line tax columns.
 */
export const extractTaxLinesFromCalculation = (calculation) => {
  const lines = calculation?.line_items?.data;

  if (!Array.isArray(lines)) {
    throw new Error("Stripe Tax calculation is missing its line items.");
  }

  if (calculation.line_items.has_more) {
    throw new Error("Stripe Tax calculation returned more line items than expected.");
  }

  const byReference = new Map(lines.map((line) => [line.reference, line]));

  const known = new Set(Object.values(TAX_LINE_REFERENCES));

  for (const reference of byReference.keys()) {
    if (!known.has(reference)) {
      throw new Error(`Stripe Tax calculation has an unexpected line "${reference}".`);
    }
  }

  const taxFor = (key) => {
    const amountTax = byReference.get(TAX_LINE_REFERENCES[key])?.amount_tax ?? 0;

    if (!Number.isInteger(amountTax) || amountTax < 0) {
      throw new Error(`Stripe Tax returned an invalid tax amount for ${key}.`);
    }

    return amountTax;
  };

  const result = {
    tax_on_base_cents: taxFor("base"),
    tax_on_buyer_fee_cents: taxFor("buyerFee"),
    tax_on_tip_cents: taxFor("tip"),
    tax_on_support_cents: taxFor("support"),
  };

  const sum =
    result.tax_on_base_cents +
    result.tax_on_buyer_fee_cents +
    result.tax_on_tip_cents +
    result.tax_on_support_cents;

  // Every line is tax-exclusive, so this must equal Stripe's own total.
  if (
    typeof calculation.tax_amount_exclusive === "number" &&
    calculation.tax_amount_exclusive !== sum
  ) {
    throw new Error(
      `Stripe Tax per-line tax (${sum}) does not match its exclusive total (${calculation.tax_amount_exclusive}).`,
    );
  }

  return {
    ...result,
    jurisdictionRegion:
      String(calculation?.customer_details?.address?.state || "").trim().toUpperCase() ||
      null,
  };
};

/**
 * Stripe Checkout line items with every component -- including tax --
 * shown separately before payment (Fee Schedule section 6). Asserts the
 * lines add up to the stored total, which is what the webhook later checks
 * against session.amount_total.
 */
export const buildCheckoutLineItems = ({ payment, title, metadata }) => {
  const taxLabel = payment.tax_jurisdiction_region
    ? `Tax (${payment.tax_jurisdiction_country}-${payment.tax_jurisdiction_region})`
    : `Tax (${payment.tax_jurisdiction_country})`;

  const lines = [
    { name: title, amount: payment.base_amount_cents },
    { name: "Buyer service fee", amount: payment.buyer_service_fee_cents },
    { name: "Creator tip", amount: payment.creator_tip_cents },
    { name: "Made for Stream support", amount: payment.platform_support_cents },
    { name: taxLabel, amount: payment.tax_cents || 0 },
  ].filter((line) => line.amount > 0);

  const sum = lines.reduce((total, line) => total + line.amount, 0);

  if (sum !== payment.total_checkout_cents) {
    throw new Error(
      `Checkout lines (${sum}) do not add up to the payment total (${payment.total_checkout_cents}).`,
    );
  }

  return lines.map((line) => ({
    price_data: {
      currency: payment.currency,
      unit_amount: line.amount,
      product_data: { name: line.name, metadata },
    },
    quantity: 1,
  }));
};

/**
 * Line items for stripe.tax.transactions.createReversal (mode "partial").
 * Stripe wants negative amounts, each matched to the original transaction
 * line by id. `refund` carries this refund's per-line amounts and tax.
 */
export const buildTaxReversalLineItems = (transactionLineItems, refund) => {
  const originalByReference = new Map(
    (transactionLineItems || []).map((line) => [line.reference, line]),
  );

  const lines = [
    { key: "base", amount: refund.baseRefundCents, tax: refund.thisBaseTaxRefund },
    { key: "buyerFee", amount: refund.thisBuyerFeeRefund, tax: refund.thisBuyerFeeTaxRefund },
    { key: "tip", amount: refund.tipRefundCents, tax: refund.thisTipTaxRefund },
    { key: "support", amount: refund.contributionRefundCents, tax: refund.thisSupportTaxRefund },
  ].filter((line) => line.amount > 0 || line.tax > 0);

  return lines.map((line) => {
    const reference = TAX_LINE_REFERENCES[line.key];
    const original = originalByReference.get(reference);

    if (!original?.id) {
      throw new Error(`Stripe Tax transaction has no "${reference}" line to reverse.`);
    }

    return {
      original_line_item: original.id,
      reference: `${reference}_refund`,
      amount: -line.amount,
      amount_tax: -line.tax,
    };
  });
};
