import { allowsMilestonePayments } from "./listingRequestAgreements";

export type ListingRequestMilestoneStatus =
  | "pending"
  | "submitted"
  | "revision_requested"
  | "buyer_approved"
  | "payment_required"
  | "paid"
  | "cancelled";

export type ListingRequestMilestoneTone =
  | "muted"
  | "review"
  | "success"
  | "danger";

export type ListingRequestMilestonePlanItem = {
  title: string;
  description?: string | null;
  amount: number;
  sortOrder: number;
};

export type ListingRequestMilestonePlanValidation = {
  isValid: boolean;
  errors: string[];
  milestoneTotal: number;
};

const roundCurrencyAmount = (
  amount: number
): number =>
  Math.round((amount + Number.EPSILON) * 100) /
  100;

export const getListingRequestMilestoneStatusLabel = (
  status: ListingRequestMilestoneStatus
): string =>
  status === "pending"
    ? "Not started"
    : status === "submitted"
      ? "Awaiting buyer review"
      : status === "revision_requested"
        ? "Revision requested"
        : status === "buyer_approved"
          ? "Approved by buyer"
          : status === "payment_required"
            ? "Payment required"
            : status === "paid"
              ? "Paid"
              : "Cancelled";

export const getListingRequestMilestoneStatusSummary = (
  status: ListingRequestMilestoneStatus
): string =>
  status === "pending"
    ? "The creator has not submitted this milestone yet."
    : status === "submitted"
      ? "The milestone is ready for buyer review."
      : status === "revision_requested"
        ? "The buyer requested changes to this milestone."
        : status === "buyer_approved"
          ? "The buyer approved this milestone."
          : status === "payment_required"
            ? "The milestone was approved and its payment is now required."
            : status === "paid"
              ? "The milestone payment was confirmed."
              : "This milestone was cancelled.";

export const getListingRequestMilestoneStatusTone = (
  status: ListingRequestMilestoneStatus
): ListingRequestMilestoneTone =>
  status === "submitted" ||
  status === "payment_required"
    ? "review"
    : status === "buyer_approved" ||
        status === "paid"
      ? "success"
      : status === "revision_requested"
        ? "danger"
        : "muted";

export const canSubmitListingRequestMilestone = (
  status: ListingRequestMilestoneStatus
): boolean =>
  status === "pending" ||
  status === "revision_requested";

export const canBuyerRespondToListingRequestMilestone = (
  status: ListingRequestMilestoneStatus
): boolean => status === "submitted";

export const canConfirmListingRequestMilestonePayment = (
  status: ListingRequestMilestoneStatus
): boolean => status === "payment_required";

export const getListingRequestMilestonePlanTotal = (
  milestones: ListingRequestMilestonePlanItem[]
): number =>
  roundCurrencyAmount(
    milestones.reduce(
      (total, milestone) =>
        total + milestone.amount,
      0
    )
  );

export const validateListingRequestMilestonePlan = (
  input: {
    estimatedWorkDays: number;
    agreementTotal: number;
    milestones: ListingRequestMilestonePlanItem[];
  }
): ListingRequestMilestonePlanValidation => {
  const errors: string[] = [];

  const agreementTotal = roundCurrencyAmount(
    input.agreementTotal
  );

  const milestoneTotal =
    getListingRequestMilestonePlanTotal(
      input.milestones
    );

  if (
    !allowsMilestonePayments(
      input.estimatedWorkDays
    )
  ) {
    errors.push(
      "Milestone payments require an estimated project length greater than 14 days."
    );
  }

  if (input.milestones.length < 2) {
    errors.push(
      "Add at least two milestones to use milestone payments."
    );
  }

  const sortOrders = new Set<number>();

  input.milestones.forEach(
    (milestone, index) => {
      const cleanTitle = milestone.title.trim();
      const cleanDescription =
        milestone.description?.trim() ?? "";

      if (
        cleanTitle.length < 3 ||
        cleanTitle.length > 160
      ) {
        errors.push(
          `Milestone ${index + 1} title must be between 3 and 160 characters.`
        );
      }

      if (cleanDescription.length > 2000) {
        errors.push(
          `Milestone ${index + 1} description cannot exceed 2000 characters.`
        );
      }

      if (
        !Number.isFinite(milestone.amount) ||
        milestone.amount <= 0
      ) {
        errors.push(
          `Milestone ${index + 1} amount must be greater than 0.`
        );
      }

      if (
        !Number.isInteger(milestone.sortOrder) ||
        milestone.sortOrder < 0
      ) {
        errors.push(
          `Milestone ${index + 1} has an invalid order.`
        );
      }

      if (sortOrders.has(milestone.sortOrder)) {
        errors.push(
          "Milestone order values must be unique."
        );
      }

      sortOrders.add(milestone.sortOrder);
    }
  );

  if (
    Number.isFinite(agreementTotal) &&
    agreementTotal > 0 &&
    milestoneTotal !== agreementTotal
  ) {
    errors.push(
      "Milestone amounts must equal the total agreement amount."
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    milestoneTotal,
  };
};