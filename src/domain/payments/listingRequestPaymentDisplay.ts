import { formatMoney } from "../../lib/formatMoney";
import type {
  ListingRequestPaymentRow,
  ListingRequestPaymentStatus,
  ListingRequestPaymentType,
} from "../../hooks/payments/useListingRequestPayments";

export const getListingRequestPaymentTypeLabel = (
  paymentType: ListingRequestPaymentType,
): string => {
  const labelByType: Record<ListingRequestPaymentType, string> = {
    one_time: "Project payment",
    starting_payment: "Starting payment",
    milestone_payment: "Milestone payment",
    change_order_payment: "Change order payment",
    final_balance: "Final balance",
  };

  return labelByType[paymentType];
};

export const getListingRequestPaymentStatusLabel = (
  status: ListingRequestPaymentStatus,
): string => {
  const labelByStatus: Record<ListingRequestPaymentStatus, string> = {
    requires_checkout: "Payment required",
    checkout_opened: "Checkout started",
    processing: "Processing",
    paid: "Paid",
    failed: "Payment failed",
    refunded: "Refunded",
    partially_refunded: "Partially refunded",
    disputed: "Disputed",
    cancelled: "Cancelled",
  };

  return labelByStatus[status];
};

export const getListingRequestPaymentActionLabel = (
  status: ListingRequestPaymentStatus,
): string | null =>
  status === "requires_checkout"
    ? "Pay now"
    : status === "checkout_opened"
      ? "Continue payment"
      : status === "failed"
        ? "Retry payment"
        : null;

export const canOpenListingRequestPaymentCheckout = (
  payment: Pick<ListingRequestPaymentRow, "status">,
): boolean =>
  payment.status === "requires_checkout" ||
  payment.status === "checkout_opened" ||
  payment.status === "failed";

export const getListingRequestPaymentTitle = (
  payment: Pick<ListingRequestPaymentRow, "metadata" | "payment_type">,
): string => {
  const metadataTitle = payment.metadata?.payment_title;

  return typeof metadataTitle === "string" && metadataTitle.trim()
    ? metadataTitle.trim()
    : getListingRequestPaymentTypeLabel(payment.payment_type);
};

// Payment amounts are stored in minor units. This assumes a two-decimal
// currency, which holds for the CAD and USD amounts supported today.
export const formatPaymentCents = (cents: number, currency: string): string =>
  formatMoney(cents / 100, currency);

// 500 -> "5%", 250 -> "2.5%", 125 -> "1.25%". Trailing zeros are dropped so a
// whole-number rate does not read as "5.00%".
export const formatFeeRateBps = (bps: number): string =>
  `${Number((bps / 100).toFixed(2))}%`;

// Explains the buyer service fee on a payment the buyer is about to make.
//
// Derived from the rate and minimum recorded on the payment row, not from a
// hardcoded 5% / 1.00 -- those are per-payment snapshots and they will vary once
// the currency registry lands. A fee larger than the percentage means the
// minimum was the binding figure.
export const describeBuyerServiceFee = (payment: {
  base_amount_cents: number;
  buyer_service_fee_cents: number;
  buyer_service_fee_bps: number;
  buyer_service_fee_minimum_cents: number;
  currency: string;
}): string => {
  const rate = formatFeeRateBps(payment.buyer_service_fee_bps);
  const percentageFeeCents = Math.ceil(
    (payment.base_amount_cents * payment.buyer_service_fee_bps) / 10000,
  );

  if (payment.buyer_service_fee_cents > percentageFeeCents) {
    const minimum = formatPaymentCents(
      payment.buyer_service_fee_minimum_cents,
      payment.currency,
    );

    return `${rate} of the project payment, with a ${minimum} minimum. The minimum applies here because ${rate} of this payment is less than ${minimum}.`;
  }

  return `${rate} of the project payment.`;
};
