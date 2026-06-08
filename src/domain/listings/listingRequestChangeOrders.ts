import type { ListingRequestChangeOrderStatus } from "./listingRequestAgreements";

export type ListingRequestChangeOrderTone =
  | "muted"
  | "review"
  | "success"
  | "danger";

export type ListingRequestChangeOrderImpact = {
  changesScope?: boolean;
  changesPrice?: boolean;
  changesTimeline?: boolean;
  changesDeliverables?: boolean;
  changesPaymentSchedule?: boolean;
  changesMilestones?: boolean;
};

export const listingRequestChangeOrderStatusOptions: Array<{
  value: ListingRequestChangeOrderStatus;
  label: string;
}> = [
  {
    value: "draft",
    label: "Draft",
  },
  {
    value: "sent",
    label: "Awaiting buyer review",
  },
  {
    value: "buyer_accepted",
    label: "Accepted by buyer",
  },
  {
    value: "buyer_declined",
    label: "Declined by buyer",
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

export const getListingRequestChangeOrderStatusLabel = (
  status: ListingRequestChangeOrderStatus
): string =>
  status === "draft"
    ? "Draft"
    : status === "sent"
      ? "Awaiting buyer review"
      : status === "buyer_accepted"
        ? "Accepted by buyer"
        : status === "buyer_declined"
          ? "Declined by buyer"
          : status === "cancelled"
            ? "Cancelled"
            : "Superseded";

export const getListingRequestChangeOrderStatusSummary = (
  status: ListingRequestChangeOrderStatus
): string =>
  status === "draft"
    ? "The creator is preparing this change order."
    : status === "sent"
      ? "The buyer must review and respond before these project changes become enforceable."
      : status === "buyer_accepted"
        ? "The buyer accepted these project changes."
        : status === "buyer_declined"
          ? "The buyer declined these proposed project changes."
          : status === "cancelled"
            ? "This change order was cancelled."
            : "This change order was replaced by a newer proposal.";

export const getListingRequestChangeOrderStatusTone = (
  status: ListingRequestChangeOrderStatus
): ListingRequestChangeOrderTone =>
  status === "draft" ||
  status === "cancelled" ||
  status === "superseded"
    ? "muted"
    : status === "sent"
      ? "review"
      : status === "buyer_accepted"
        ? "success"
        : "danger";

export const canSendListingRequestChangeOrder = (
  status: ListingRequestChangeOrderStatus
): boolean => status === "draft";

export const canBuyerRespondToListingRequestChangeOrder = (
  status: ListingRequestChangeOrderStatus
): boolean => status === "sent";

export const isListingRequestChangeOrderBuyerVisible = (input: {
  status: ListingRequestChangeOrderStatus;
  sentAt: string | null;
}): boolean => input.status !== "draft" && Boolean(input.sentAt);

export const hasListingRequestChangeOrderImpact = (
  impact: ListingRequestChangeOrderImpact
): boolean =>
  Boolean(
    impact.changesScope ||
      impact.changesPrice ||
      impact.changesTimeline ||
      impact.changesDeliverables ||
      impact.changesPaymentSchedule ||
      impact.changesMilestones
  );

export const getListingRequestChangeOrderImpactLabels = (
  impact: ListingRequestChangeOrderImpact
): string[] => {
  const labels: string[] = [];

  if (impact.changesScope) {
    labels.push("Scope");
  }

  if (impact.changesPrice) {
    labels.push("Price");
  }

  if (impact.changesTimeline) {
    labels.push("Timeline");
  }

  if (impact.changesDeliverables) {
    labels.push("Deliverables");
  }

  if (impact.changesPaymentSchedule) {
    labels.push("Payment schedule");
  }

  if (impact.changesMilestones) {
    labels.push("Milestones");
  }

  return labels;
};