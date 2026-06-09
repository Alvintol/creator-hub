import { describe, expect, it } from "vitest";

import {
  allowsMilestonePayments,
  areRequiredAgreementAcknowledgementsChecked,
  calculateRoundedBuyerHoldDays,
  calculateTotalRoundedBuyerHoldDays,
  canApplyListingRequestChangeOrder,
  canBuyerAcceptListingRequestAgreement,
  canSendListingRequestAgreement,
  canStartWorkForAcceptedRequest,
  getAdjustedEstimatedCompletionDate,
  getListingRequestAgreementStatusLabel,
  getListingRequestAgreementStatusSummary,
  getListingRequestAgreementStatusTone,
  getListingRequestBuyerHoldReasonLabel,
  getListingRequestPaymentStructureLabel,
  getListingRequestPaymentStructureSummary,
  getListingRequestPaymentTimingLabel,
  getListingRequestPaymentTimingSummary,
  getMinimumCreatorUpdateRule,
  getRequiredListingRequestAgreementAcknowledgements,
  requiresAcceptedChangeOrderForProjectTermChange,
  shouldStartBuyerTimelineHold,
} from "../listings/listingRequestAgreements";

describe("listing request agreement helpers", () => {
  it("maps agreement statuses to labels", () => {
    expect(getListingRequestAgreementStatusLabel("draft")).toBe("Draft");
    expect(getListingRequestAgreementStatusLabel("sent")).toBe(
      "Awaiting buyer review"
    );
    expect(getListingRequestAgreementStatusLabel("buyer_accepted")).toBe(
      "Accepted by buyer"
    );
    expect(getListingRequestAgreementStatusLabel("buyer_declined")).toBe(
      "Declined by buyer"
    );
    expect(getListingRequestAgreementStatusLabel("superseded")).toBe(
      "Superseded"
    );
    expect(getListingRequestAgreementStatusLabel("cancelled")).toBe(
      "Cancelled"
    );
  });

  it("maps agreement statuses to summaries", () => {
    expect(getListingRequestAgreementStatusSummary("draft")).toBe(
      "The creator is preparing the project agreement."
    );
    expect(getListingRequestAgreementStatusSummary("sent")).toBe(
      "The buyer needs to review and accept the project agreement before payment or work can begin."
    );
    expect(getListingRequestAgreementStatusSummary("buyer_accepted")).toBe(
      "The buyer accepted the project agreement."
    );
  });

  it("maps agreement statuses to tones", () => {
    expect(getListingRequestAgreementStatusTone("draft")).toBe("muted");
    expect(getListingRequestAgreementStatusTone("sent")).toBe("review");
    expect(getListingRequestAgreementStatusTone("buyer_accepted")).toBe(
      "success"
    );
    expect(getListingRequestAgreementStatusTone("buyer_declined")).toBe(
      "danger"
    );
    expect(getListingRequestAgreementStatusTone("superseded")).toBe("muted");
    expect(getListingRequestAgreementStatusTone("cancelled")).toBe("muted");
  });

  it("maps payment structures to labels and summaries", () => {
    expect(getListingRequestPaymentStructureLabel("full_prepayment")).toBe(
      "Full prepayment"
    );
    expect(getListingRequestPaymentStructureSummary("full_prepayment")).toBe(
      "The buyer pays the full accepted price before work begins."
    );

    expect(getListingRequestPaymentStructureLabel("deposit_balance")).toBe(
      "Deposit + balance"
    );
    expect(getListingRequestPaymentStructureSummary("deposit_balance")).toBe(
      "The buyer pays a deposit before work begins and pays the remaining balance before final release."
    );

    expect(getListingRequestPaymentStructureLabel("milestone_payments")).toBe(
      "Milestone payments"
    );
    expect(getListingRequestPaymentStructureSummary("milestone_payments")).toBe(
      "The buyer pays agreed milestone amounts after reviewing and approving milestone progress."
    );
  });

  it("maps payment timings to labels and summaries", () => {
    expect(getListingRequestPaymentTimingLabel("due_before_work_starts")).toBe(
      "Due before work starts"
    );
    expect(
      getListingRequestPaymentTimingSummary("due_before_work_starts")
    ).toBe("This payment must be completed before the creator starts work.");

    expect(
      getListingRequestPaymentTimingLabel("due_at_milestone_approval")
    ).toBe("Due at milestone approval");
    expect(
      getListingRequestPaymentTimingSummary("due_at_milestone_approval")
    ).toBe(
      "This payment becomes due after the buyer approves the related milestone."
    );

    expect(
      getListingRequestPaymentTimingLabel("due_before_final_release")
    ).toBe("Due before final release");
    expect(
      getListingRequestPaymentTimingSummary("due_before_final_release")
    ).toBe(
      "This payment must be completed before final files or deliverables are released."
    );
  });

  it("requires one progress update for work estimated under one week", () => {
    expect(getMinimumCreatorUpdateRule(4)).toEqual({
      rule: "single_progress_update",
      label: "One progress update required",
      summary:
        "This project is estimated under one week, so the creator must provide at least one progress update before final delivery.",
      firstUpdateDueDays: null,
      updateFrequencyDays: null,
      recommendedCheckpoints: ["50% progress update"],
    });
  });

  it("requires weekly updates for work estimated at one week or longer", () => {
    expect(getMinimumCreatorUpdateRule(14)).toEqual({
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
    });
  });

  it("allows milestone payments only for projects longer than two weeks", () => {
    expect(allowsMilestonePayments(14)).toBe(false);
    expect(allowsMilestonePayments(15)).toBe(true);
    expect(allowsMilestonePayments(30)).toBe(true);
  });

  it("allows sending only draft agreements", () => {
    expect(canSendListingRequestAgreement("draft")).toBe(true);
    expect(canSendListingRequestAgreement("sent")).toBe(false);
    expect(canSendListingRequestAgreement("buyer_accepted")).toBe(false);
  });

  it("allows buyer acceptance only for sent agreements", () => {
    expect(canBuyerAcceptListingRequestAgreement("sent")).toBe(true);
    expect(canBuyerAcceptListingRequestAgreement("draft")).toBe(false);
    expect(canBuyerAcceptListingRequestAgreement("buyer_accepted")).toBe(false);
  });

  it("allows work to start only after request acceptance, agreement acceptance, and starting payment clearance", () => {
    expect(
      canStartWorkForAcceptedRequest({
        requestStatus: "accepted",
        agreementStatus: "buyer_accepted",
        startingPaymentStatus: "paid",
      })
    ).toBe(true);

    expect(
      canStartWorkForAcceptedRequest({
        requestStatus: "accepted",
        agreementStatus: "buyer_accepted",
        startingPaymentStatus: "not_required",
      })
    ).toBe(true);

    expect(
      canStartWorkForAcceptedRequest({
        requestStatus: "submitted",
        agreementStatus: "buyer_accepted",
        startingPaymentStatus: "paid",
      })
    ).toBe(false);

    expect(
      canStartWorkForAcceptedRequest({
        requestStatus: "accepted",
        agreementStatus: "sent",
        startingPaymentStatus: "paid",
      })
    ).toBe(false);

    expect(
      canStartWorkForAcceptedRequest({
        requestStatus: "accepted",
        agreementStatus: "buyer_accepted",
        startingPaymentStatus: "payment_required",
      })
    ).toBe(false);
  });

  it("applies change orders only after buyer acceptance", () => {
    expect(canApplyListingRequestChangeOrder("buyer_accepted")).toBe(true);
    expect(canApplyListingRequestChangeOrder("sent")).toBe(false);
    expect(canApplyListingRequestChangeOrder("buyer_declined")).toBe(false);
  });

  it("requires accepted change orders for project term changes", () => {
    expect(
      requiresAcceptedChangeOrderForProjectTermChange({
        changesScope: true,
      })
    ).toBe(true);

    expect(
      requiresAcceptedChangeOrderForProjectTermChange({
        changesPrice: true,
      })
    ).toBe(true);

    expect(
      requiresAcceptedChangeOrderForProjectTermChange({
        changesTimeline: true,
      })
    ).toBe(true);

    expect(
      requiresAcceptedChangeOrderForProjectTermChange({
        changesPaymentSchedule: true,
      })
    ).toBe(true);

    expect(
      requiresAcceptedChangeOrderForProjectTermChange({
        changesDeliverables: true,
      })
    ).toBe(true);

    expect(requiresAcceptedChangeOrderForProjectTermChange({})).toBe(false);
  });
});

describe("listing request buyer timeline hold helpers", () => {
  it("maps buyer hold reasons to labels", () => {
    expect(
      getListingRequestBuyerHoldReasonLabel("agreement_acceptance_pending")
    ).toBe("Agreement acceptance pending");

    expect(
      getListingRequestBuyerHoldReasonLabel("starting_payment_pending")
    ).toBe("Starting payment pending");

    expect(
      getListingRequestBuyerHoldReasonLabel("milestone_approval_pending")
    ).toBe("Milestone approval pending");

    expect(
      getListingRequestBuyerHoldReasonLabel("milestone_payment_pending")
    ).toBe("Milestone payment pending");

    expect(
      getListingRequestBuyerHoldReasonLabel("change_order_response_pending")
    ).toBe("Change order response pending");

    expect(
      getListingRequestBuyerHoldReasonLabel("balance_payment_pending")
    ).toBe("Balance payment pending");

    expect(
      getListingRequestBuyerHoldReasonLabel(
        "change_order_payment_pending"
      )
    ).toBe("Change order payment pending");
  });

  it("rounds buyer hold time up to full calendar days", () => {
    expect(
      calculateRoundedBuyerHoldDays({
        startedAt: "2026-05-01T12:00:00.000Z",
        endedAt: "2026-05-02T18:00:00.000Z",
      })
    ).toBe(2);
  });

  it("returns zero hold days when the hold has no positive duration", () => {
    expect(
      calculateRoundedBuyerHoldDays({
        startedAt: "2026-05-02T12:00:00.000Z",
        endedAt: "2026-05-02T12:00:00.000Z",
      })
    ).toBe(0);

    expect(
      calculateRoundedBuyerHoldDays({
        startedAt: "2026-05-03T12:00:00.000Z",
        endedAt: "2026-05-02T12:00:00.000Z",
      })
    ).toBe(0);
  });

  it("totals completed buyer holds and ignores active holds", () => {
    expect(
      calculateTotalRoundedBuyerHoldDays([
        {
          reason: "starting_payment_pending",
          startedAt: "2026-05-01T12:00:00.000Z",
          endedAt: "2026-05-02T18:00:00.000Z",
        },
        {
          reason: "change_order_response_pending",
          startedAt: "2026-05-04T12:00:00.000Z",
          endedAt: null,
        },
      ])
    ).toBe(2);
  });

  it("extends the estimated completion date by rounded buyer hold days", () => {
    expect(
      getAdjustedEstimatedCompletionDate({
        estimatedCompletionDate: "2026-06-10T12:00:00.000Z",
        holds: [
          {
            reason: "milestone_payment_pending",
            startedAt: "2026-06-01T12:00:00.000Z",
            endedAt: "2026-06-02T18:00:00.000Z",
          },
        ],
      })
    ).toBe("2026-06-12T12:00:00.000Z");
  });

  it("starts a buyer timeline hold when buyer action is required", () => {
    expect(
      shouldStartBuyerTimelineHold({
        requiresBuyerAgreement: true,
      })
    ).toBe(true);

    expect(
      shouldStartBuyerTimelineHold({
        requiresBuyerPayment: true,
      })
    ).toBe(true);

    expect(
      shouldStartBuyerTimelineHold({
        requiresBuyerMilestoneApproval: true,
      })
    ).toBe(true);

    expect(
      shouldStartBuyerTimelineHold({
        requiresBuyerChangeOrderResponse: true,
      })
    ).toBe(true);

    expect(shouldStartBuyerTimelineHold({})).toBe(false);
  });
});

describe("listing request agreement acknowledgement helpers", () => {
  const agreement = {
    id: "agreement-1",
    scope_summary: "Create a custom overlay package.",
    additional_cost_policy:
      "Additional work requires an accepted change order.",
    revision_policy: "Includes two revision passes.",
    update_schedule_summary: "Weekly updates required.",
    estimated_completion_at: "2026-06-15T12:00:00.000Z",
    adjusted_estimated_completion_at: "2026-06-17T12:00:00.000Z",
    listing_request_agreement_items: [
      {
        id: "item-2",
        title: "BRB screen",
        is_required: true,
        is_selected: true,
        sort_order: 1,
      },
      {
        id: "item-1",
        title: "Starting soon screen",
        is_required: true,
        is_selected: true,
        sort_order: 0,
      },
      {
        id: "item-3",
        title: "Optional animated version",
        is_required: false,
        is_selected: false,
        sort_order: 2,
      },
    ],
    listing_request_payment_schedule_items: [
      {
        id: "payment-1",
        title: "Deposit",
        amount: 100,
        currency: "cad",
        sort_order: 0,
      },
    ],
  };

  it("builds required acknowledgement items from agreement scope, payments, and policies", () => {
    const acknowledgements =
      getRequiredListingRequestAgreementAcknowledgements(agreement);

    expect(acknowledgements).toEqual([
      {
        key: "agreement:scope_summary",
        label: "I understand the project scope summary.",
      },
      {
        key: "scope_item:item-1",
        label: "I understand this scope item: Starting soon screen",
      },
      {
        key: "scope_item:item-2",
        label: "I understand this scope item: BRB screen",
      },
      {
        key: "agreement:payment_schedule",
        label: "I understand the payment schedule.",
      },
      {
        key: "payment_item:payment-1",
        label: "I understand this payment item: Deposit",
      },
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
    ]);
  });

  it("confirms when every required acknowledgement is checked", () => {
    const requiredAcknowledgements =
      getRequiredListingRequestAgreementAcknowledgements(agreement);

    expect(
      areRequiredAgreementAcknowledgementsChecked({
        requiredAcknowledgements,
        checkedKeys: requiredAcknowledgements.map(
          (acknowledgement) => acknowledgement.key
        ),
      })
    ).toBe(true);
  });

  it("does not confirm when a required acknowledgement is missing", () => {
    const requiredAcknowledgements =
      getRequiredListingRequestAgreementAcknowledgements(agreement);

    expect(
      areRequiredAgreementAcknowledgementsChecked({
        requiredAcknowledgements,
        checkedKeys: requiredAcknowledgements
          .map((acknowledgement) => acknowledgement.key)
          .filter((key) => key !== "agreement:payment_schedule"),
      })
    ).toBe(false);
  });
});