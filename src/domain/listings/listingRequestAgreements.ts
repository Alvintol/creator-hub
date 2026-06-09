export type ListingRequestAgreementStatus =
  | "draft"
  | "sent"
  | "buyer_accepted"
  | "buyer_declined"
  | "superseded"
  | "cancelled";

export type ListingRequestAgreementTone =
  | "muted"
  | "review"
  | "success"
  | "danger";

export type ListingRequestPaymentStructure =
  | "full_prepayment"
  | "deposit_balance"
  | "milestone_payments";

export type ListingRequestPaymentTiming =
  | "due_before_work_starts"
  | "due_at_milestone_approval"
  | "due_before_final_release"
  | "due_on_change_order_acceptance"
  | "included_no_extra_charge"
  | "optional_not_selected";

export type ListingRequestStartingPaymentStatus =
  | "not_required"
  | "payment_required"
  | "paid";

export type ListingRequestChangeOrderStatus =
  | "draft"
  | "sent"
  | "buyer_accepted"
  | "buyer_declined"
  | "cancelled"
  | "superseded";

export type ListingRequestMinimumUpdateRule = {
  rule: "single_progress_update" | "weekly_updates";
  label: string;
  summary: string;
  firstUpdateDueDays: number | null;
  updateFrequencyDays: number | null;
  recommendedCheckpoints: string[];
};

export const listingRequestAgreementStatusOptions: Array<{
  value: ListingRequestAgreementStatus;
  label: string;
}> = [
    { value: "draft", label: "Draft" },
    { value: "sent", label: "Awaiting buyer review" },
    { value: "buyer_accepted", label: "Accepted by buyer" },
    { value: "buyer_declined", label: "Declined by buyer" },
    { value: "superseded", label: "Superseded" },
    { value: "cancelled", label: "Cancelled" },
  ];

export const listingRequestPaymentStructureOptions: Array<{
  value: ListingRequestPaymentStructure;
  label: string;
}> = [
    { value: "full_prepayment", label: "Full prepayment" },
    { value: "deposit_balance", label: "Deposit + balance" },
    { value: "milestone_payments", label: "Milestone payments" },
  ];

export type ListingRequestBuyerHoldReason =
  | "agreement_acceptance_pending"
  | "starting_payment_pending"
  | "milestone_approval_pending"
  | "milestone_payment_pending"
  | "change_order_response_pending"
  | "change_order_payment_pending"
  | "balance_payment_pending";

export type ListingRequestTimelineHold = {
  reason: ListingRequestBuyerHoldReason;
  startedAt: string;
  endedAt: string | null;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const getListingRequestBuyerHoldReasonLabel = (
  reason: ListingRequestBuyerHoldReason
): string =>
  reason === "agreement_acceptance_pending"
    ? "Agreement acceptance pending"
    : reason === "starting_payment_pending"
      ? "Starting payment pending"
      : reason === "milestone_approval_pending"
        ? "Milestone approval pending"
        : reason === "milestone_payment_pending"
          ? "Milestone payment pending"
          : reason === "change_order_response_pending"
            ? "Change order response pending"
            : reason === "change_order_payment_pending"
              ? "Change order payment pending"
              : "Balance payment pending";

export const calculateRoundedBuyerHoldDays = (input: {
  startedAt: string;
  endedAt: string;
}): number => {
  const startedAt = new Date(input.startedAt).getTime();
  const endedAt = new Date(input.endedAt).getTime();

  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)) {
    return 0;
  }

  const holdMs = endedAt - startedAt;

  if (holdMs <= 0) {
    return 0;
  }

  return Math.ceil(holdMs / MS_PER_DAY);
};

export const calculateTotalRoundedBuyerHoldDays = (
  holds: ListingRequestTimelineHold[]
): number =>
  holds.reduce((total, hold) => {
    if (!hold.endedAt) {
      return total;
    }

    return (
      total +
      calculateRoundedBuyerHoldDays({
        startedAt: hold.startedAt,
        endedAt: hold.endedAt,
      })
    );
  }, 0);

export const addCalendarDaysToIsoDate = (
  isoDate: string,
  daysToAdd: number
): string => {
  const date = new Date(isoDate);

  if (!Number.isFinite(date.getTime()) || daysToAdd <= 0) {
    return isoDate;
  }

  date.setUTCDate(date.getUTCDate() + daysToAdd);

  return date.toISOString();
};

export const getAdjustedEstimatedCompletionDate = (input: {
  estimatedCompletionDate: string;
  holds: ListingRequestTimelineHold[];
}): string => {
  const totalHoldDays = calculateTotalRoundedBuyerHoldDays(input.holds);

  return addCalendarDaysToIsoDate(input.estimatedCompletionDate, totalHoldDays);
};

export const shouldStartBuyerTimelineHold = (input: {
  requiresBuyerAgreement?: boolean;
  requiresBuyerPayment?: boolean;
  requiresBuyerMilestoneApproval?: boolean;
  requiresBuyerChangeOrderResponse?: boolean;
}): boolean =>
  Boolean(
    input.requiresBuyerAgreement ||
    input.requiresBuyerPayment ||
    input.requiresBuyerMilestoneApproval ||
    input.requiresBuyerChangeOrderResponse
  );

export const getListingRequestAgreementStatusLabel = (
  status: ListingRequestAgreementStatus
): string =>
  status === "draft"
    ? "Draft"
    : status === "sent"
      ? "Awaiting buyer review"
      : status === "buyer_accepted"
        ? "Accepted by buyer"
        : status === "buyer_declined"
          ? "Declined by buyer"
          : status === "superseded"
            ? "Superseded"
            : "Cancelled";

export const getListingRequestAgreementStatusSummary = (
  status: ListingRequestAgreementStatus
): string =>
  status === "draft"
    ? "The creator is preparing the project agreement."
    : status === "sent"
      ? "The buyer needs to review and accept the project agreement before payment or work can begin."
      : status === "buyer_accepted"
        ? "The buyer accepted the project agreement."
        : status === "buyer_declined"
          ? "The buyer declined this project agreement."
          : status === "superseded"
            ? "This agreement was replaced by a newer version."
            : "This agreement was cancelled.";

export const getListingRequestAgreementStatusTone = (
  status: ListingRequestAgreementStatus
): ListingRequestAgreementTone =>
  status === "draft" || status === "superseded" || status === "cancelled"
    ? "muted"
    : status === "sent"
      ? "review"
      : status === "buyer_accepted"
        ? "success"
        : "danger";

export const getListingRequestPaymentStructureLabel = (
  structure: ListingRequestPaymentStructure
): string =>
  structure === "full_prepayment"
    ? "Full prepayment"
    : structure === "deposit_balance"
      ? "Deposit + balance"
      : "Milestone payments";

export const getListingRequestPaymentStructureSummary = (
  structure: ListingRequestPaymentStructure
): string =>
  structure === "full_prepayment"
    ? "The buyer pays the full accepted price before work begins."
    : structure === "deposit_balance"
      ? "The buyer pays a deposit before work begins and pays the remaining balance before final release."
      : "The buyer pays agreed milestone amounts after reviewing and approving milestone progress.";

export const getListingRequestPaymentTimingLabel = (
  timing: ListingRequestPaymentTiming
): string =>
  timing === "due_before_work_starts"
    ? "Due before work starts"
    : timing === "due_at_milestone_approval"
      ? "Due at milestone approval"
      : timing === "due_before_final_release"
        ? "Due before final release"
        : timing === "due_on_change_order_acceptance"
          ? "Due when change order is accepted"
          : timing === "included_no_extra_charge"
            ? "Included, no extra charge"
            : "Optional, not selected";

export const getListingRequestPaymentTimingSummary = (
  timing: ListingRequestPaymentTiming
): string =>
  timing === "due_before_work_starts"
    ? "This payment must be completed before the creator starts work."
    : timing === "due_at_milestone_approval"
      ? "This payment becomes due after the buyer approves the related milestone."
      : timing === "due_before_final_release"
        ? "This payment must be completed before final files or deliverables are released."
        : timing === "due_on_change_order_acceptance"
          ? "This payment becomes due when the buyer accepts the change order."
          : timing === "included_no_extra_charge"
            ? "This item is included in the accepted agreement at no extra charge."
            : "This optional item is not part of the accepted agreement.";

export const getMinimumCreatorUpdateRule = (
  estimatedWorkDays: number
): ListingRequestMinimumUpdateRule => {
  // Keep the rule stable even if the creator enters a rough/invalid estimate.
  const safeEstimatedDays = Math.max(1, Math.ceil(estimatedWorkDays));

  return safeEstimatedDays < 7
    ? {
      rule: "single_progress_update",
      label: "One progress update required",
      summary:
        "This project is estimated under one week, so the creator must provide at least one progress update before final delivery.",
      firstUpdateDueDays: null,
      updateFrequencyDays: null,
      recommendedCheckpoints: ["50% progress update"],
    }
    : {
      rule: "weekly_updates",
      label: "Weekly updates required",
      summary:
        "This project is estimated at one week or longer, so the creator must provide weekly progress updates until delivery.",
      firstUpdateDueDays: 5,
      updateFrequencyDays: 7,
      recommendedCheckpoints: [
        "First update within 5 days",
        "Weekly progress update",
        "Pre-final preview",
      ],
    };
};

export const allowsMilestonePayments = (estimatedWorkDays: number): boolean =>
  estimatedWorkDays > 14;

export const canSendListingRequestAgreement = (
  status: ListingRequestAgreementStatus
): boolean => status === "draft";

export const canBuyerAcceptListingRequestAgreement = (
  status: ListingRequestAgreementStatus
): boolean => status === "sent";

export const canStartWorkForAcceptedRequest = (input: {
  requestStatus: string;
  agreementStatus: ListingRequestAgreementStatus;
  startingPaymentStatus: ListingRequestStartingPaymentStatus;
}): boolean =>
  input.requestStatus === "accepted" &&
  input.agreementStatus === "buyer_accepted" &&
  input.startingPaymentStatus !== "payment_required";

export const canApplyListingRequestChangeOrder = (
  status: ListingRequestChangeOrderStatus
): boolean => status === "buyer_accepted";

export const requiresAcceptedChangeOrderForProjectTermChange = (input: {
  changesScope?: boolean;
  changesPrice?: boolean;
  changesTimeline?: boolean;
  changesPaymentSchedule?: boolean;
  changesDeliverables?: boolean;
}): boolean =>
  Boolean(
    input.changesScope ||
    input.changesPrice ||
    input.changesTimeline ||
    input.changesPaymentSchedule ||
    input.changesDeliverables
  );

export type ListingRequestAgreementAcknowledgementInput = {
  id: string;
  scope_summary: string;
  additional_cost_policy: string;
  revision_policy?: string | null;
  update_schedule_summary?: string | null;
  estimated_completion_at: string;
  adjusted_estimated_completion_at: string;
  listing_request_agreement_items: Array<{
    id: string;
    title: string;
    is_required: boolean;
    is_selected: boolean;
    sort_order: number;
  }>;
  listing_request_payment_schedule_items: Array<{
    id: string;
    title: string;
    amount: number;
    currency: string;
    sort_order: number;
  }>;
};

export type ListingRequestAgreementAcknowledgement = {
  key: string;
  label: string;
};

const sortBySortOrder = <T extends { sort_order: number }>(items: T[]): T[] =>
  [...items].sort((a, b) => a.sort_order - b.sort_order);

export const getRequiredListingRequestAgreementAcknowledgements = (
  agreement: ListingRequestAgreementAcknowledgementInput
): ListingRequestAgreementAcknowledgement[] => {
  const requiredScopeItems = sortBySortOrder(
    agreement.listing_request_agreement_items.filter(
      (item) => item.is_required && item.is_selected
    )
  ).map((item) => ({
    key: `scope_item:${item.id}`,
    label: `I understand this scope item: ${item.title}`,
  }));

  const requiredPaymentItems = sortBySortOrder(
    agreement.listing_request_payment_schedule_items
  ).map((item) => ({
    key: `payment_item:${item.id}`,
    label: `I understand this payment item: ${item.title}`,
  }));

  return [
    {
      key: "agreement:scope_summary",
      label: "I understand the project scope summary.",
    },
    ...requiredScopeItems,
    {
      key: "agreement:payment_schedule",
      label: "I understand the payment schedule.",
    },
    ...requiredPaymentItems,
    {
      key: "agreement:timeline",
      label:
        "I understand the estimated completion date and buyer-side hold rules.",
    },
    {
      key: "agreement:update_schedule",
      label: "I understand the creator update schedule.",
    },
    {
      key: "agreement:revision_policy",
      label: "I understand the included revision policy.",
    },
    {
      key: "agreement:additional_cost_policy",
      label: "I understand the additional cost policy.",
    },
    {
      key: "agreement:change_orders",
      label:
        "I understand scope, price, timeline, deliverable, or payment changes require an accepted change order.",
    },
    {
      key: "agreement:final_release_payment",
      label:
        "I understand final files or deliverables may be held until required payments are complete.",
    },
  ];
};

export const areRequiredAgreementAcknowledgementsChecked = (input: {
  requiredAcknowledgements: ListingRequestAgreementAcknowledgement[];
  checkedKeys: string[];
}): boolean => {
  const checkedSet = new Set(input.checkedKeys);

  return input.requiredAcknowledgements.every((acknowledgement) =>
    checkedSet.has(acknowledgement.key)
  );
};