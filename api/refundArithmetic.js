// Sprint 5 (launch-scope.md section 6.2): the cumulative proportional
// refund arithmetic, extracted out of the /api/stripe/refunds route so it
// has a test harness (AGENTS.md: "api/server.js has no tests at all. Any
// substantial change there should start closing that gap.") This mirrors
// apply_refunded_listing_request_payment in
// supabase/migrations/20260922_125_add_listing_request_payment_refund_ledger.sql
// exactly -- the database function is what actually gets written and is the
// source of truth; this copy is what decides the amounts passed to Stripe
// before that function is ever called, so the two must never diverge.

export const sumRefundField = (refunds, field) =>
  (refunds || []).reduce((sum, refund) => sum + refund[field], 0);

/**
 * @param {{ base_amount_cents: number, buyer_service_fee_cents: number, creator_platform_fee_cents: number }} payment
 * @param {Array<{ base_refund_cents: number, buyer_fee_refund_cents: number, creator_fee_reversal_cents: number }>} existingRefunds
 * @param {number} baseRefundCents
 */
export const computeCumulativeRefund = (
  payment,
  existingRefunds,
  baseRefundCents,
) => {
  if (!Number.isFinite(baseRefundCents) || baseRefundCents <= 0) {
    throw new Error("A refund must have a base amount greater than zero.");
  }

  const alreadyBaseRefunded = sumRefundField(existingRefunds, "base_refund_cents");
  const alreadyBuyerFeeRefunded = sumRefundField(
    existingRefunds,
    "buyer_fee_refund_cents",
  );
  const alreadyCreatorFeeReversed = sumRefundField(
    existingRefunds,
    "creator_fee_reversal_cents",
  );

  const cumulativeBase = alreadyBaseRefunded + baseRefundCents;

  if (cumulativeBase > payment.base_amount_cents) {
    throw new Error(
      `Refunding ${baseRefundCents} cents would exceed the ${payment.base_amount_cents} cent base amount (${alreadyBaseRefunded} already refunded).`,
    );
  }

  const isFinalRefund = cumulativeBase >= payment.base_amount_cents;

  const buyerFeeCumulative = isFinalRefund
    ? payment.buyer_service_fee_cents
    : Math.round(
        (payment.buyer_service_fee_cents * cumulativeBase) /
          payment.base_amount_cents,
      );

  const creatorFeeCumulative = isFinalRefund
    ? payment.creator_platform_fee_cents
    : Math.round(
        (payment.creator_platform_fee_cents * cumulativeBase) /
          payment.base_amount_cents,
      );

  return {
    cumulativeBase,
    isFinalRefund,
    thisBuyerFeeRefund: Math.max(buyerFeeCumulative - alreadyBuyerFeeRefunded, 0),
    thisCreatorFeeReversal: Math.max(
      creatorFeeCumulative - alreadyCreatorFeeReversed,
      0,
    ),
  };
};
