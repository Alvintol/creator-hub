import { describe, expect, it } from "vitest";

import {
  computeCumulativeListingRequestPaymentRefund,
  isTipOrContributionRefundWithinWindow,
} from "../payments/listingRequestPaymentRefunds";

describe("computeCumulativeListingRequestPaymentRefund", () => {
  const payment = {
    base_amount_cents: 10000,
    buyer_service_fee_cents: 500,
    creator_platform_fee_cents: 500,
  };

  it("computes a full refund as the full fee, in one shot", () => {
    const result = computeCumulativeListingRequestPaymentRefund(
      payment,
      [],
      10000,
    );

    expect(result.isFinalRefund).toBe(true);
    expect(result.cumulativeBaseRefundedCents).toBe(10000);
    expect(result.thisBuyerFeeRefundCents).toBe(500);
    expect(result.thisCreatorFeeReversalCents).toBe(500);
  });

  it("computes a partial refund proportionally", () => {
    const result = computeCumulativeListingRequestPaymentRefund(
      payment,
      [],
      2500,
    );

    expect(result.isFinalRefund).toBe(false);
    // 500 * 2500 / 10000 = 125
    expect(result.thisBuyerFeeRefundCents).toBe(125);
    expect(result.thisCreatorFeeReversalCents).toBe(125);
  });

  it("computes cumulatively across repeated partial refunds, subtracting what was already returned", () => {
    const firstRefund = computeCumulativeListingRequestPaymentRefund(
      payment,
      [],
      3333,
    );

    // 500 * 3333 / 10000 = 166.65 -> rounds to 167
    expect(firstRefund.thisBuyerFeeRefundCents).toBe(167);

    const priorRefunds = [
      {
        base_refund_cents: 3333,
        buyer_fee_refund_cents: firstRefund.thisBuyerFeeRefundCents,
        creator_fee_reversal_cents: firstRefund.thisCreatorFeeReversalCents,
      },
    ];

    const secondRefund = computeCumulativeListingRequestPaymentRefund(
      payment,
      priorRefunds,
      3333,
    );

    // cumulative base = 6666 -> cumulative buyer fee = 500*6666/10000 = 333.3 -> 333
    // this refund's share = 333 - 167 = 166
    expect(secondRefund.cumulativeBaseRefundedCents).toBe(6666);
    expect(secondRefund.thisBuyerFeeRefundCents).toBe(166);
    expect(secondRefund.isFinalRefund).toBe(false);

    const finalRefund = computeCumulativeListingRequestPaymentRefund(
      payment,
      [
        ...priorRefunds,
        {
          base_refund_cents: 3333,
          buyer_fee_refund_cents: secondRefund.thisBuyerFeeRefundCents,
          creator_fee_reversal_cents: secondRefund.thisCreatorFeeReversalCents,
        },
      ],
      3334,
    );

    // The final refund closes out the base amount exactly and returns
    // whatever fee remainder is left, rather than a third rounded ratio --
    // 500 - 167 - 166 = 167, not round(500 * 3334 / 10000) = 167 by
    // coincidence here, but the mechanism is "return what's left," not "round
    // again."
    expect(finalRefund.isFinalRefund).toBe(true);
    expect(finalRefund.cumulativeBaseRefundedCents).toBe(10000);
    expect(finalRefund.thisBuyerFeeRefundCents).toBe(
      500 - firstRefund.thisBuyerFeeRefundCents - secondRefund.thisBuyerFeeRefundCents,
    );

    // Across all three refunds, the buyer fee refunded sums to exactly the
    // original fee -- no rounding remainder is lost or double-counted.
    const totalBuyerFeeRefunded =
      firstRefund.thisBuyerFeeRefundCents +
      secondRefund.thisBuyerFeeRefundCents +
      finalRefund.thisBuyerFeeRefundCents;

    expect(totalBuyerFeeRefunded).toBe(payment.buyer_service_fee_cents);
  });

  it("throws if the refund would exceed the base amount actually paid", () => {
    expect(() =>
      computeCumulativeListingRequestPaymentRefund(payment, [], 10001),
    ).toThrow(/exceed/);

    expect(() =>
      computeCumulativeListingRequestPaymentRefund(
        payment,
        [{ base_refund_cents: 9000, buyer_fee_refund_cents: 450, creator_fee_reversal_cents: 450 }],
        1001,
      ),
    ).toThrow(/exceed/);
  });

  it("throws for a zero or negative refund amount", () => {
    expect(() =>
      computeCumulativeListingRequestPaymentRefund(payment, [], 0),
    ).toThrow(/greater than zero/);
  });
});

describe("computeCumulativeListingRequestPaymentRefund -- tax (Sprint 7)", () => {
  // CAD 100 base, 5% fees, a 10.00 tip and 5.00 contribution, taxed at an
  // awkward 13% on every line so the rounding is actually exercised:
  // base 1300, buyer fee 65, tip 130, contribution 65.
  const payment = {
    base_amount_cents: 10000,
    buyer_service_fee_cents: 500,
    creator_platform_fee_cents: 500,
    creator_tip_cents: 1000,
    platform_support_cents: 500,
    tax_on_base_cents: 1300,
    tax_on_buyer_fee_cents: 65,
    tax_on_tip_cents: 130,
    tax_on_support_cents: 65,
  };

  const toLedgerRow = (
    baseRefundCents: number,
    result: ReturnType<typeof computeCumulativeListingRequestPaymentRefund>,
    tipRefundCents = 0,
    contributionRefundCents = 0,
  ) => ({
    base_refund_cents: baseRefundCents,
    buyer_fee_refund_cents: result.thisBuyerFeeRefundCents,
    creator_fee_reversal_cents: result.thisCreatorFeeReversalCents,
    tip_refund_cents: tipRefundCents,
    contribution_refund_cents: contributionRefundCents,
    base_tax_refund_cents: result.thisBaseTaxRefundCents,
    buyer_fee_tax_refund_cents: result.thisBuyerFeeTaxRefundCents,
    tip_tax_refund_cents: result.thisTipTaxRefundCents,
    support_tax_refund_cents: result.thisSupportTaxRefundCents,
  });

  it("returns every line's full tax on a single full refund", () => {
    const result = computeCumulativeListingRequestPaymentRefund(payment, [], 10000, {
      tipRefundCents: 1000,
      contributionRefundCents: 500,
    });

    expect(result.thisBaseTaxRefundCents).toBe(1300);
    expect(result.thisBuyerFeeTaxRefundCents).toBe(65);
    expect(result.thisTipTaxRefundCents).toBe(130);
    expect(result.thisSupportTaxRefundCents).toBe(65);
    expect(result.thisTaxRefundCents).toBe(1560);
  });

  it("adjusts base and buyer-fee tax proportionally to the base refunded", () => {
    const result = computeCumulativeListingRequestPaymentRefund(payment, [], 2500);

    // 1300 * 0.25 = 325; 65 * 0.25 = 16.25 -> 16
    expect(result.thisBaseTaxRefundCents).toBe(325);
    expect(result.thisBuyerFeeTaxRefundCents).toBe(16);
    // A partial base refund does not prorate the tip or contribution, so
    // their tax is untouched too.
    expect(result.thisTipTaxRefundCents).toBe(0);
    expect(result.thisSupportTaxRefundCents).toBe(0);
  });

  it("returns exactly the original tax across repeated partial refunds -- no rounding drift", () => {
    const refunds: ReturnType<typeof toLedgerRow>[] = [];
    const bases = [3333, 3333, 1, 3333];

    for (const base of bases) {
      const result = computeCumulativeListingRequestPaymentRefund(payment, refunds, base);
      refunds.push(toLedgerRow(base, result));
    }

    const sum = (key: keyof ReturnType<typeof toLedgerRow>) =>
      refunds.reduce((total, row) => total + row[key], 0);

    // Each step is cumulative: 3333 -> round(1300 * .3333) = 433,
    // 6666 -> 867 (434 more), 6667 -> 867 (0 more), 10000 -> the exact rest.
    expect(refunds.map((row) => row.base_tax_refund_cents)).toEqual([433, 434, 0, 433]);
    expect(sum("base_tax_refund_cents")).toBe(payment.tax_on_base_cents);
    expect(sum("buyer_fee_tax_refund_cents")).toBe(payment.tax_on_buyer_fee_cents);
    expect(sum("buyer_fee_refund_cents")).toBe(payment.buyer_service_fee_cents);
  });

  it("adjusts tip and contribution tax by their own refunded amounts, cumulatively", () => {
    const first = computeCumulativeListingRequestPaymentRefund(payment, [], 1000, {
      tipRefundCents: 333,
      contributionRefundCents: 250,
    });

    // 130 * 333/1000 = 43.29 -> 43; 65 * 250/500 = 32.5 -> 33
    expect(first.thisTipTaxRefundCents).toBe(43);
    expect(first.thisSupportTaxRefundCents).toBe(33);

    const prior = [toLedgerRow(1000, first, 333, 250)];

    const second = computeCumulativeListingRequestPaymentRefund(payment, prior, 1000, {
      tipRefundCents: 333,
    });

    // cumulative tip 666 -> round(86.58) = 87, so 44 more
    expect(second.thisTipTaxRefundCents).toBe(44);
    expect(second.thisSupportTaxRefundCents).toBe(0);

    prior.push(toLedgerRow(1000, second, 333, 0));

    const last = computeCumulativeListingRequestPaymentRefund(payment, prior, 8000, {
      tipRefundCents: 334,
      contributionRefundCents: 250,
    });

    // Fully refunded lines return exactly what is left.
    expect(last.thisTipTaxRefundCents).toBe(130 - 43 - 44);
    expect(last.thisSupportTaxRefundCents).toBe(65 - 33);
    expect(last.thisBaseTaxRefundCents + first.thisBaseTaxRefundCents + second.thisBaseTaxRefundCents).toBe(1300);
  });

  it("refunds no tax on a payment that had none (pre-Sprint 7 or not collected)", () => {
    const result = computeCumulativeListingRequestPaymentRefund(
      { base_amount_cents: 10000, buyer_service_fee_cents: 500, creator_platform_fee_cents: 500 },
      [],
      5000,
    );

    expect(result.thisTaxRefundCents).toBe(0);
  });
});

describe("isTipOrContributionRefundWithinWindow", () => {
  const now = new Date("2026-09-22T00:00:00Z");

  it("is always within the window on a final (full-cancellation-style) refund", () => {
    expect(
      isTipOrContributionRefundWithinWindow({
        isFinalRefund: true,
        paidAt: "2020-01-01T00:00:00Z",
        requestCancelledAt: null,
        now,
      }),
    ).toBe(true);
  });

  it("is within the window inside 14 days of payment", () => {
    expect(
      isTipOrContributionRefundWithinWindow({
        isFinalRefund: false,
        paidAt: "2026-09-10T00:00:00Z",
        requestCancelledAt: null,
        now,
      }),
    ).toBe(true);
  });

  it("is outside the window past 14 days of payment with no cancellation", () => {
    expect(
      isTipOrContributionRefundWithinWindow({
        isFinalRefund: false,
        paidAt: "2026-08-01T00:00:00Z",
        requestCancelledAt: null,
        now,
      }),
    ).toBe(false);
  });

  it("uses cancellation date when it is later than the payment date", () => {
    expect(
      isTipOrContributionRefundWithinWindow({
        isFinalRefund: false,
        paidAt: "2026-08-01T00:00:00Z",
        requestCancelledAt: "2026-09-15T00:00:00Z",
        now,
      }),
    ).toBe(true);
  });
});
