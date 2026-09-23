import { describe, expect, it } from "vitest";
import { computeCumulativeRefund } from "../refundArithmetic.js";
import { computeCumulativeListingRequestPaymentRefund } from "../../src/domain/payments/listingRequestPaymentRefunds";

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

// Sprint 7: the tax lines. The frontend copy has the worked examples
// (src/domain/tests/listingRequestPaymentRefunds.test.ts); this proves the
// API copy -- the one that decides what Stripe actually refunds -- agrees
// with it on every step of many randomized refund sequences, and that
// every line's tax always closes out to exactly the original.

describe("computeCumulativeRefund -- tax", () => {
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

  it("includes tax in a full refund", () => {
    const result = computeCumulativeRefund(payment, [], 10000, {
      tipRefundCents: 1000,
      contributionRefundCents: 500,
    });

    expect(result.thisTaxRefund).toBe(1560);
  });

  it("matches the frontend mirror and closes out exactly across randomized refund sequences", () => {
    // Deterministic PRNG so a failure is reproducible.
    let seed = 20260923;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };

    for (let run = 0; run < 200; run += 1) {
      const ledger = [];
      let baseLeft = payment.base_amount_cents;
      let tipLeft = payment.creator_tip_cents;
      let contributionLeft = payment.platform_support_cents;

      while (baseLeft > 0) {
        const isLast = random() < 0.2 || baseLeft < 50;
        const base = isLast ? baseLeft : 1 + Math.floor(random() * (baseLeft - 1));
        const tip = isLast ? tipLeft : Math.floor(random() * tipLeft * 0.5);
        const contribution = isLast
          ? contributionLeft
          : Math.floor(random() * contributionLeft * 0.5);

        const api = computeCumulativeRefund(payment, ledger, base, {
          tipRefundCents: tip,
          contributionRefundCents: contribution,
        });
        const ui = computeCumulativeListingRequestPaymentRefund(payment, ledger, base, {
          tipRefundCents: tip,
          contributionRefundCents: contribution,
        });

        expect([
          api.thisBuyerFeeRefund,
          api.thisCreatorFeeReversal,
          api.thisBaseTaxRefund,
          api.thisBuyerFeeTaxRefund,
          api.thisTipTaxRefund,
          api.thisSupportTaxRefund,
        ]).toEqual([
          ui.thisBuyerFeeRefundCents,
          ui.thisCreatorFeeReversalCents,
          ui.thisBaseTaxRefundCents,
          ui.thisBuyerFeeTaxRefundCents,
          ui.thisTipTaxRefundCents,
          ui.thisSupportTaxRefundCents,
        ]);

        ledger.push({
          base_refund_cents: base,
          buyer_fee_refund_cents: api.thisBuyerFeeRefund,
          creator_fee_reversal_cents: api.thisCreatorFeeReversal,
          tip_refund_cents: tip,
          contribution_refund_cents: contribution,
          base_tax_refund_cents: api.thisBaseTaxRefund,
          buyer_fee_tax_refund_cents: api.thisBuyerFeeTaxRefund,
          tip_tax_refund_cents: api.thisTipTaxRefund,
          support_tax_refund_cents: api.thisSupportTaxRefund,
        });

        baseLeft -= base;
        tipLeft -= tip;
        contributionLeft -= contribution;
      }

      const total = (field) => ledger.reduce((sum, row) => sum + row[field], 0);

      expect(total("base_tax_refund_cents")).toBe(payment.tax_on_base_cents);
      expect(total("buyer_fee_tax_refund_cents")).toBe(payment.tax_on_buyer_fee_cents);
      expect(total("tip_tax_refund_cents")).toBe(payment.tax_on_tip_cents);
      expect(total("support_tax_refund_cents")).toBe(payment.tax_on_support_cents);
      expect(total("buyer_fee_refund_cents")).toBe(payment.buyer_service_fee_cents);
    }
  });
});
