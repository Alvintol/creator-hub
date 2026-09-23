// Mirrors apply_refunded_listing_request_payment's arithmetic
// (supabase/migrations/20260923_137_add_listing_request_payment_tax.sql,
// originally 20260922_125) exactly, so the admin refund UI can preview the
// effect of a refund before it is issued. The database function is the
// source of truth for what actually gets written -- this exists only for
// display, the same reason describeBuyerServiceFee mirrors the fee bridge's
// arithmetic rather than recomputing anything server-side.
//
// Section 6.2 (launch-scope.md): the buyer fee and creator fee are refunded
// / reversed cumulatively and proportionally to the base amount refunded so
// far, rounded once against the cumulative figure -- never by rounding each
// partial refund independently, which is exactly what would let repeated
// roundings drift past the original fee. A refund that reaches the full
// base amount returns the exact remaining fee rather than the rounded
// ratio, so the final partial refund always closes out any accumulated
// rounding remainder.
//
// Sprint 7 (Refund Policy section 8): tax follows the same pattern per
// line. Base and buyer-fee tax follow the cumulative base; tip and
// contribution tax follow the cumulative tip / contribution refunded, since
// those are refunded explicitly rather than prorated. Every tax field is
// optional so payments and refunds from before Sprint 7 read as zero tax.

export type ListingRequestPaymentRefundInput = {
  base_amount_cents: number;
  buyer_service_fee_cents: number;
  creator_platform_fee_cents: number;
  creator_tip_cents?: number;
  platform_support_cents?: number;
  tax_on_base_cents?: number;
  tax_on_buyer_fee_cents?: number;
  tax_on_tip_cents?: number;
  tax_on_support_cents?: number;
};

export type ListingRequestPaymentRefundState = {
  base_refund_cents: number;
  buyer_fee_refund_cents: number;
  creator_fee_reversal_cents: number;
  tip_refund_cents?: number;
  contribution_refund_cents?: number;
  base_tax_refund_cents?: number;
  buyer_fee_tax_refund_cents?: number;
  tip_tax_refund_cents?: number;
  support_tax_refund_cents?: number;
};

export type RefundExtras = {
  tipRefundCents?: number;
  contributionRefundCents?: number;
};

export type CumulativeRefundResult = {
  cumulativeBaseRefundedCents: number;
  buyerFeeRefundCumulativeCents: number;
  creatorFeeReversalCumulativeCents: number;
  thisBuyerFeeRefundCents: number;
  thisCreatorFeeReversalCents: number;
  thisBaseTaxRefundCents: number;
  thisBuyerFeeTaxRefundCents: number;
  thisTipTaxRefundCents: number;
  thisSupportTaxRefundCents: number;
  thisTaxRefundCents: number;
  isFinalRefund: boolean;
};

const sumBy = (
  refunds: ListingRequestPaymentRefundState[],
  key: keyof ListingRequestPaymentRefundState,
): number => refunds.reduce((sum, refund) => sum + (refund[key] ?? 0), 0);

// Banker's-unaware "round half away from zero" matches Postgres's `round()`
// on a numeric for the positive values this always operates on.
const roundCents = (value: number): number => Math.round(value);

// The cumulative share of `lineTax` owed once `cumulativeRefunded` of
// `lineAmount` has been refunded -- the exact tax once the line is fully
// refunded, never a rounded ratio.
const cumulativeLineTax = (
  lineTax: number | undefined,
  lineAmount: number | undefined,
  cumulativeRefunded: number,
): number => {
  if (!lineTax || !lineAmount) {
    return 0;
  }

  if (cumulativeRefunded >= lineAmount) {
    return lineTax;
  }

  return roundCents((lineTax * cumulativeRefunded) / lineAmount);
};

export const computeCumulativeListingRequestPaymentRefund = (
  payment: ListingRequestPaymentRefundInput,
  priorRefunds: ListingRequestPaymentRefundState[],
  baseRefundCents: number,
  { tipRefundCents = 0, contributionRefundCents = 0 }: RefundExtras = {},
): CumulativeRefundResult => {
  if (baseRefundCents <= 0) {
    throw new Error("A refund must have a base amount greater than zero.");
  }

  const alreadyBaseRefunded = sumBy(priorRefunds, "base_refund_cents");
  const alreadyBuyerFeeRefunded = sumBy(priorRefunds, "buyer_fee_refund_cents");
  const alreadyCreatorFeeReversed = sumBy(
    priorRefunds,
    "creator_fee_reversal_cents",
  );

  const cumulativeBaseRefundedCents = alreadyBaseRefunded + baseRefundCents;

  if (cumulativeBaseRefundedCents > payment.base_amount_cents) {
    throw new Error(
      `Refunding ${baseRefundCents} cents would exceed the ${payment.base_amount_cents} cent base amount (${alreadyBaseRefunded} already refunded).`,
    );
  }

  const isFinalRefund = cumulativeBaseRefundedCents >= payment.base_amount_cents;

  const buyerFeeRefundCumulativeCents = isFinalRefund
    ? payment.buyer_service_fee_cents
    : roundCents(
        (payment.buyer_service_fee_cents * cumulativeBaseRefundedCents) /
          payment.base_amount_cents,
      );

  const creatorFeeReversalCumulativeCents = isFinalRefund
    ? payment.creator_platform_fee_cents
    : roundCents(
        (payment.creator_platform_fee_cents * cumulativeBaseRefundedCents) /
          payment.base_amount_cents,
      );

  const cumulativeTipRefunded =
    sumBy(priorRefunds, "tip_refund_cents") + tipRefundCents;
  const cumulativeContributionRefunded =
    sumBy(priorRefunds, "contribution_refund_cents") + contributionRefundCents;

  const thisTaxFor = (
    cumulative: number,
    key: keyof ListingRequestPaymentRefundState,
  ): number => Math.max(cumulative - sumBy(priorRefunds, key), 0);

  const thisBaseTaxRefundCents = thisTaxFor(
    cumulativeLineTax(
      payment.tax_on_base_cents,
      payment.base_amount_cents,
      cumulativeBaseRefundedCents,
    ),
    "base_tax_refund_cents",
  );

  // Buyer-fee tax follows the base, like the buyer fee itself.
  const thisBuyerFeeTaxRefundCents = thisTaxFor(
    isFinalRefund
      ? (payment.tax_on_buyer_fee_cents ?? 0)
      : roundCents(
          ((payment.tax_on_buyer_fee_cents ?? 0) * cumulativeBaseRefundedCents) /
            payment.base_amount_cents,
        ),
    "buyer_fee_tax_refund_cents",
  );

  const thisTipTaxRefundCents = thisTaxFor(
    cumulativeLineTax(
      payment.tax_on_tip_cents,
      payment.creator_tip_cents,
      cumulativeTipRefunded,
    ),
    "tip_tax_refund_cents",
  );

  const thisSupportTaxRefundCents = thisTaxFor(
    cumulativeLineTax(
      payment.tax_on_support_cents,
      payment.platform_support_cents,
      cumulativeContributionRefunded,
    ),
    "support_tax_refund_cents",
  );

  return {
    cumulativeBaseRefundedCents,
    buyerFeeRefundCumulativeCents,
    creatorFeeReversalCumulativeCents,
    thisBuyerFeeRefundCents: Math.max(
      buyerFeeRefundCumulativeCents - alreadyBuyerFeeRefunded,
      0,
    ),
    thisCreatorFeeReversalCents: Math.max(
      creatorFeeReversalCumulativeCents - alreadyCreatorFeeReversed,
      0,
    ),
    thisBaseTaxRefundCents,
    thisBuyerFeeTaxRefundCents,
    thisTipTaxRefundCents,
    thisSupportTaxRefundCents,
    thisTaxRefundCents:
      thisBaseTaxRefundCents +
      thisBuyerFeeTaxRefundCents +
      thisTipTaxRefundCents +
      thisSupportTaxRefundCents,
    isFinalRefund,
  };
};

// Refund Policy section 8: a tip or contribution refund is only automatic
// (no mistaken/duplicate/unauthorised override needed) within 14 days of
// payment, or of the project's cancellation, whichever is later -- and
// never needs the window at all on a full-cancellation-style refund (the
// caller passes isFinalRefund for that).
export const isTipOrContributionRefundWithinWindow = ({
  isFinalRefund,
  paidAt,
  requestCancelledAt,
  now = new Date(),
}: {
  isFinalRefund: boolean;
  paidAt: string | null;
  requestCancelledAt: string | null;
  now?: Date;
}): boolean => {
  if (isFinalRefund) {
    return true;
  }

  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

  const withinPaidWindow =
    paidAt !== null && now.getTime() - new Date(paidAt).getTime() <= fourteenDaysMs;

  const withinCancelledWindow =
    requestCancelledAt !== null &&
    now.getTime() - new Date(requestCancelledAt).getTime() <= fourteenDaysMs;

  return withinPaidWindow || withinCancelledWindow;
};
