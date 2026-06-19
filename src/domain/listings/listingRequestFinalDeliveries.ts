import { ListingRequestFinalDeliveryRow } from '../../hooks/creatorRequests/useListingRequestFinalDeliveries';

export type ListingRequestFinalDeliveryStatus =
  | "draft"
  | "submitted"
  | "revision_requested"
  | "buyer_approved"
  | "cancelled"
  | "superseded";

export type ListingRequestFinalDeliveryTone =
  | "muted"
  | "review"
  | "success"
  | "danger";

type ListingRequestFinalDeliveryPaymentItem = {
  payment_timing: string;
  status: string;
  amount?: number | null;
};

type ListingRequestFinalDeliveryAgreement = {
  status: string;
  starting_payment_status: string;
  payment_structure?: string | null;
  listing_request_payment_schedule_items?:
  | ListingRequestFinalDeliveryPaymentItem[]
  | null;
};

export const getHasAllMilestonePaymentsPaid = (
  agreement: ListingRequestFinalDeliveryAgreement | null
): boolean => {
  if (!agreement) {
    return false;
  }

  if (
    agreement.payment_structure !==
    "milestone_payments"
  ) {
    return true;
  }

  const milestonePaymentItems =
    agreement.listing_request_payment_schedule_items?.filter(
      (paymentItem) =>
        paymentItem.payment_timing ===
        "due_at_milestone_approval"
    ) ?? [];

  return (
    milestonePaymentItems.length > 0 &&
    milestonePaymentItems.every(
      (paymentItem) =>
        paymentItem.status === "paid"
    )
  );
};

export const listingRequestFinalDeliveryStatusOptions: Array<{
  value: ListingRequestFinalDeliveryStatus;
  label: string;
}> = [
    {
      value: "draft",
      label: "Draft",
    },
    {
      value: "submitted",
      label: "Awaiting buyer review",
    },
    {
      value: "revision_requested",
      label: "Revision requested",
    },
    {
      value: "buyer_approved",
      label: "Approved by buyer",
    },
    {
      value: "cancelled",
      label: "Cancelled",
    },
    {
      value: "superseded",
      label: "Superseded",
    },
  ];

export const getListingRequestFinalDeliveryStatusLabel = (
  status: ListingRequestFinalDeliveryStatus
): string =>
  status === "draft"
    ? "Draft"
    : status === "submitted"
      ? "Awaiting buyer review"
      : status === "revision_requested"
        ? "Revision requested"
        : status === "buyer_approved"
          ? "Approved by buyer"
          : status === "cancelled"
            ? "Cancelled"
            : "Superseded";

export const getListingRequestFinalDeliveryStatusSummary = (
  status: ListingRequestFinalDeliveryStatus
): string =>
  status === "draft"
    ? "The creator is preparing the final delivery."
    : status === "submitted"
      ? "The final delivery is ready for buyer review."
      : status === "revision_requested"
        ? "The buyer requested revisions to this delivery."
        : status === "buyer_approved"
          ? "The buyer approved this final delivery."
          : status === "cancelled"
            ? "This final delivery was cancelled."
            : "This delivery was replaced by a newer version.";

export const getListingRequestFinalDeliveryStatusTone = (
  status: ListingRequestFinalDeliveryStatus
): ListingRequestFinalDeliveryTone =>
  status === "draft" ||
    status === "cancelled" ||
    status === "superseded"
    ? "muted"
    : status === "submitted"
      ? "review"
      : status === "buyer_approved"
        ? "success"
        : "danger";

export const canSubmitListingRequestFinalDelivery = (
  status: ListingRequestFinalDeliveryStatus
): boolean => status === "draft";

export const canBuyerRespondToListingRequestFinalDelivery = (
  status: ListingRequestFinalDeliveryStatus
): boolean => status === "submitted";

export const canCreateNextListingRequestFinalDelivery = (
  agreement: ListingRequestFinalDeliveryAgreement | null,
  finalDeliveries: ListingRequestFinalDeliveryRow[]
): boolean => {
  if (!agreement) {
    return false;
  }

  if (agreement.status !== "buyer_accepted") {
    return false;
  }

  if (
    agreement.starting_payment_status !== "paid" &&
    agreement.starting_payment_status !== "not_required"
  ) {
    return false;
  }

  if (!getHasAllMilestonePaymentsPaid(agreement)) {
    return false;
  }

  const latestFinalDelivery =
    [...finalDeliveries].sort(
      (firstDelivery, secondDelivery) =>
        new Date(secondDelivery.created_at).getTime() -
        new Date(firstDelivery.created_at).getTime()
    )[0] ?? null;

  if (!latestFinalDelivery) {
    return true;
  }

  return (
    latestFinalDelivery.status === "revision_requested" ||
    latestFinalDelivery.status === "cancelled"
  );
};

export const isListingRequestFinalDeliveryBuyerVisible = (input: {
  status: ListingRequestFinalDeliveryStatus;
  submittedAt: string | null;
}): boolean =>
  input.status !== "draft" &&
  Boolean(input.submittedAt);

export const hasListingRequestFinalDeliveryContent = (input: {
  summary?: string | null;
  deliveryLinks?: string[];
}): boolean =>
  Boolean(
    input.summary?.trim() ||
    input.deliveryLinks?.some((link) => link.trim())
  );