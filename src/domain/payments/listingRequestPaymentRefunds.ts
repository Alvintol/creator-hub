// Mirrors apply_refunded_listing_request_payment's arithmetic
// (supabase/migrations/20260922_125_add_listing_request_payment_refund_ledger.sql)
// exactly, so the admin refund UI can preview the effect of a refund before
// it is issued. The database function is the source of truth for what
// actually gets written -- this exists only for display, the same reason
// describeBuyerServiceFee mirrors the fee bridge's arithmetic rather than
// recomputing anything server-side.
//
// Section 6.2 (launch-scope.md): the buyer fee and creator fee are refunded
// / reversed cumulatively and proportionally to the base amount refunded so
// far, rounded once against the cumulative figure -- never by rounding each
// partial refund independently, which is exactly what would let repeated
// roundings drift past the original fee. A refund that reaches the full
// base amount returns the exact remaining fee rather than the rounded
// ratio, so the final partial refund always closes out any accumulated
// rounding remainder.

export type ListingRequestPaymentRefundInput = {
  base_amount_cents: number;
  buyer_service_fee_cents: number;
  creator_platform_fee_cents: number;
};

export type ListingRequestPaymentRefundState = {
  base_refund_cents: number;
  buyer_fee_refund_cents: number;
  creator_fee_reversal_cents: number;
};

export type CumulativeRefundResult = {
  cumulativeBaseRefundedCents: number;
  buyerFeeRefundCumulativeCents: number;
  creatorFeeReversalCumulativeCents: number;
  thisBuyerFeeRefundCents: number;
  thisCreatorFeeReversalCents: number;
  isFinalRefund: boolean;
};

const sumBy = (
  refunds: ListingRequestPaymentRefundState[],
  key: keyof ListingRequestPaymentRefundState,
): number => refunds.reduce((sum, refund) => sum + refund[key], 0);

// Banker's-unaware "round half away from zero" matches Postgres's `round()`
// on a numeric for the positive values this always operates on.
const roundCents = (value: number): number => Math.round(value);

export const computeCumulativeListingRequestPaymentRefund = (
  payment: ListingRequestPaymentRefundInput,
  priorRefunds: ListingRequestPaymentRefundState[],
  baseRefundCents: number,
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
