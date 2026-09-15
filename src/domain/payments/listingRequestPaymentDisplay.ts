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
  payment: ListingRequestPaymentRow,
): string => {
  const metadataTitle = payment.metadata?.payment_title;

  return typeof metadataTitle === "string" && metadataTitle.trim()
    ? metadataTitle.trim()
    : getListingRequestPaymentTypeLabel(payment.payment_type);
};