import { describe, expect, it } from "vitest";
import { computeCumulativeRefund } from "../refundArithmetic.js";

// Mirrors the equivalent suite in
// src/domain/tests/listingRequestPaymentRefunds.test.ts, which exercises
// the same arithmetic on the frontend's copy (used for admin UI preview).
// Both copies must mirror apply_refunded_listing_request_payment
// (supabase/migrations/20260922_125_add_listing_request_payment_refund_ledger.sql),
// the database function that is the actual source of truth.

describe("computeCumulativeRefund", () => {
  const payment = {
    base_amount_cents: 10000,
    buyer_service_fee_cents: 500,
    creator_platform_fee_cents: 500,
  };

  it("computes a full refund as the full fee, in one shot", () => {
    const result = computeCumulativeRefund(payment, [], 10000);

    expect(result.isFinalRefund).toBe(true);
    expect(result.cumulativeBase).toBe(10000);
    expect(result.thisBuyerFeeRefund).toBe(500);
    expect(result.thisCreatorFeeReversal).toBe(500);
  });

  it("computes a partial refund proportionally", () => {
    const result = computeCumulativeRefund(payment, [], 2500);

    expect(result.isFinalRefund).toBe(false);
    expect(result.thisBuyerFeeRefund).toBe(125);
    expect(result.thisCreatorFeeReversal).toBe(125);
  });

  it("computes cumulatively across repeated partial refunds without exceeding the original fee", () => {
    const first = computeCumulativeRefund(payment, [], 3333);

    const second = computeCumulativeRefund(
      payment,
      [
        {
          base_refund_cents: 3333,
          buyer_fee_refund_cents: first.thisBuyerFeeRefund,
          creator_fee_reversal_cents: first.thisCreatorFeeReversal,
        },
      ],
      3333,
    );

    const final = computeCumulativeRefund(
      payment,
      [
        {
          base_refund_cents: 3333,
          buyer_fee_refund_cents: first.thisBuyerFeeRefund,
          creator_fee_reversal_cents: first.thisCreatorFeeReversal,
        },
        {
          base_refund_cents: 3333,
          buyer_fee_refund_cents: second.thisBuyerFeeRefund,
          creator_fee_reversal_cents: second.thisCreatorFeeReversal,
        },
      ],
      3334,
    );

    expect(final.isFinalRefund).toBe(true);
    expect(final.cumulativeBase).toBe(10000);

    const totalBuyerFeeRefunded =
      first.thisBuyerFeeRefund + second.thisBuyerFeeRefund + final.thisBuyerFeeRefund;
    const totalCreatorFeeReversed =
      first.thisCreatorFeeReversal +
      second.thisCreatorFeeReversal +
      final.thisCreatorFeeReversal;

    expect(totalBuyerFeeRefunded).toBe(payment.buyer_service_fee_cents);
    expect(totalCreatorFeeReversed).toBe(payment.creator_platform_fee_cents);
  });

  it("throws if the refund would exceed the base amount actually paid", () => {
    expect(() => computeCumulativeRefund(payment, [], 10001)).toThrow(/exceed/);

    expect(() =>
      computeCumulativeRefund(
        payment,
        [{ base_refund_cents: 9000, buyer_fee_refund_cents: 450, creator_fee_reversal_cents: 450 }],
        1001,
      ),
    ).toThrow(/exceed/);
  });

  it("throws for a zero, negative or non-finite refund amount", () => {
    expect(() => computeCumulativeRefund(payment, [], 0)).toThrow(
      /greater than zero/,
    );
    expect(() => computeCumulativeRefund(payment, [], -100)).toThrow(
      /greater than zero/,
    );
    expect(() => computeCumulativeRefund(payment, [], NaN)).toThrow(
      /greater than zero/,
    );
  });
});
