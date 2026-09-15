export type ListingRequestPaymentTiming =
  | "due_before_work_starts"
  | "due_at_milestone_approval"
  | "due_before_final_release"
  | "due_on_change_order_acceptance";

export type ListingRequestPaymentType =
  | "starting_payment"
  | "milestone_payment"
  | "final_balance"
  | "change_order_payment";

const paymentTypeByTiming: Record<
  ListingRequestPaymentTiming,
  ListingRequestPaymentType
> = {
  due_before_work_starts: "starting_payment",
  due_at_milestone_approval: "milestone_payment",
  due_before_final_release: "final_balance",
  due_on_change_order_acceptance: "change_order_payment",
};

export const getListingRequestPaymentTypeForTiming = (
  paymentTiming: ListingRequestPaymentTiming,
): ListingRequestPaymentType =>
  paymentTypeByTiming[paymentTiming];