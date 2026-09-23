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
