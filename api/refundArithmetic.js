// Sprint 5 (launch-scope.md section 6.2): the cumulative proportional
// refund arithmetic, extracted out of the /api/stripe/refunds route so it
// has a test harness (AGENTS.md: "api/server.js has no tests at all. Any
// substantial change there should start closing that gap.") This mirrors
// apply_refunded_listing_request_payment in
// supabase/migrations/20260923_137_add_listing_request_payment_tax.sql
// (originally 20260922_125) exactly -- the database function is what
// actually gets written and is the source of truth; this copy is what
// decides the amounts passed to Stripe before that function is ever called,
// so the two must never diverge.
//
// Sprint 7 (Refund Policy section 8): tax is adjusted with the same
// cumulative pattern -- rounded once against the original per-line tax, the
// exact remainder once a line is fully refunded. Base and buyer-fee tax
// follow the cumulative base; tip and contribution tax follow the
// cumulative tip / contribution refunded, since those are refunded
// explicitly rather than prorated.

export const sumRefundField = (refunds, field) =>
  (refunds || []).reduce((sum, refund) => sum + (refund[field] ?? 0), 0);

// The cumulative share of `lineTax` owed once `cumulativeRefunded` of
// `lineAmount` has been refunded. A fully refunded line returns its exact
// tax, never a rounded ratio.
const cumulativeLineTax = (lineTax, lineAmount, cumulativeRefunded) => {
  if (!lineTax || !lineAmount) {
    return 0;
  }

  if (cumulativeRefunded >= lineAmount) {
    return lineTax;
  }

  return Math.round((lineTax * cumulativeRefunded) / lineAmount);
};

/**
 * @param {{ base_amount_cents: number, buyer_service_fee_cents: number, creator_platform_fee_cents: number, creator_tip_cents?: number, platform_support_cents?: number, tax_on_base_cents?: number, tax_on_buyer_fee_cents?: number, tax_on_tip_cents?: number, tax_on_support_cents?: number }} payment
 * @param {Array<{ base_refund_cents: number, buyer_fee_refund_cents: number, creator_fee_reversal_cents: number, tip_refund_cents?: number, contribution_refund_cents?: number, base_tax_refund_cents?: number, buyer_fee_tax_refund_cents?: number, tip_tax_refund_cents?: number, support_tax_refund_cents?: number }>} existingRefunds
 * @param {number} baseRefundCents
 * @param {{ tipRefundCents?: number, contributionRefundCents?: number }} [extras]
 */
export const computeCumulativeRefund = (
  payment,
  existingRefunds,
  baseRefundCents,
  { tipRefundCents = 0, contributionRefundCents = 0 } = {},
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

  const cumulativeTip =
    sumRefundField(existingRefunds, "tip_refund_cents") + tipRefundCents;
  const cumulativeContribution =
    sumRefundField(existingRefunds, "contribution_refund_cents") +
    contributionRefundCents;

  const thisTaxFor = (cumulative, field) =>
    Math.max(cumulative - sumRefundField(existingRefunds, field), 0);

  const thisBaseTaxRefund = thisTaxFor(
    cumulativeLineTax(payment.tax_on_base_cents, payment.base_amount_cents, cumulativeBase),
    "base_tax_refund_cents",
  );
  const thisBuyerFeeTaxRefund = thisTaxFor(
    isFinalRefund
      ? payment.tax_on_buyer_fee_cents ?? 0
      : Math.round(
          ((payment.tax_on_buyer_fee_cents ?? 0) * cumulativeBase) /
            payment.base_amount_cents,
        ),
    "buyer_fee_tax_refund_cents",
  );
  const thisTipTaxRefund = thisTaxFor(
    cumulativeLineTax(payment.tax_on_tip_cents, payment.creator_tip_cents, cumulativeTip),
    "tip_tax_refund_cents",
  );
  const thisSupportTaxRefund = thisTaxFor(
    cumulativeLineTax(
      payment.tax_on_support_cents,
      payment.platform_support_cents,
      cumulativeContribution,
    ),
    "support_tax_refund_cents",
  );

  return {
    cumulativeBase,
    isFinalRefund,
    thisBuyerFeeRefund: Math.max(buyerFeeCumulative - alreadyBuyerFeeRefunded, 0),
    thisCreatorFeeReversal: Math.max(
      creatorFeeCumulative - alreadyCreatorFeeReversed,
      0,
    ),
    thisBaseTaxRefund,
    thisBuyerFeeTaxRefund,
    thisTipTaxRefund,
    thisSupportTaxRefund,
    thisTaxRefund:
      thisBaseTaxRefund + thisBuyerFeeTaxRefund + thisTipTaxRefund + thisSupportTaxRefund,
  };
};
