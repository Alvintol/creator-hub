import {
  render,
  screen,
} from "@testing-library/react";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import ListingRequestMilestonePaymentAdminActions from "../listingRequests/payments/ListingRequestMilestonePaymentAdminActions";
import type { ListingRequestMilestoneRow } from "../../hooks/creatorRequests/useListingRequestMilestones";

const createMilestone = (
  overrides: Partial<ListingRequestMilestoneRow> = {}
): ListingRequestMilestoneRow =>
  ({
    id: "milestone-1",
    listing_request_id: "request-1",
    agreement_id: "agreement-1",
    agreement_item_id: "agreement-item-1",
    payment_schedule_item_id: "payment-1",
    creator_user_id: "creator-1",
    buyer_user_id: "buyer-1",
    status: "payment_required",
    title: "Initial design direction",
    description:
      "First pass at the core design direction.",
    amount: 125,
    currency: "cad",
    sort_order: 0,
    submission_version: 1,
    latest_submitted_at:
      "2026-06-18T12:00:00.000Z",
    latest_revision_requested_at: null,
    buyer_approved_at:
      "2026-06-18T13:00:00.000Z",
    payment_required_at:
      "2026-06-18T13:00:00.000Z",
    paid_at: null,
    cancelled_at: null,
    created_at: "2026-06-18T12:00:00.000Z",
    updated_at: "2026-06-18T13:00:00.000Z",
    ...overrides,
  }) as ListingRequestMilestoneRow;

describe(
  "<ListingRequestMilestonePaymentAdminActions />",
  () => {
    const onConfirmPayment = vi.fn();

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("renders nothing when no milestone payment is required", () => {
      const { container } = render(
        <ListingRequestMilestonePaymentAdminActions
          milestones={[
            createMilestone({
              status: "pending",
            }),
          ]}
          onConfirmPayment={onConfirmPayment}
        />
      );

      expect(container).toBeEmptyDOMElement();
    });

    it("confirms the earliest payment-required milestone", () => {
      render(
        <ListingRequestMilestonePaymentAdminActions
          milestones={[
            createMilestone({
              id: "milestone-2",
              payment_schedule_item_id:
                "payment-2",
              title:
                "Completed project package",
              sort_order: 1,
            }),
            createMilestone({
              id: "milestone-1",
              payment_schedule_item_id:
                "payment-1",
              title:
                "Initial design direction",
              sort_order: 0,
            }),
          ]}
          onConfirmPayment={onConfirmPayment}
        />
      );

      screen
        .getByRole("button", {
          name: "Confirm milestone payment",
        })
        .click();

      expect(
        onConfirmPayment
      ).toHaveBeenCalledWith("payment-1");
    });

    it("disables the confirm button while pending", () => {
      render(
        <ListingRequestMilestonePaymentAdminActions
          milestones={[createMilestone()]}
          isPending
          onConfirmPayment={onConfirmPayment}
        />
      );

      expect(
        screen.getByRole("button", {
          name: "Confirm milestone payment",
        })
      ).toBeDisabled();
    });

    it("shows mutation errors", () => {
      render(
        <ListingRequestMilestonePaymentAdminActions
          milestones={[createMilestone()]}
          error={
            new Error(
              "This milestone is not awaiting payment confirmation."
            )
          }
          onConfirmPayment={onConfirmPayment}
        />
      );

      expect(
        screen.getByText(
          "This milestone is not awaiting payment confirmation."
        )
      ).toBeInTheDocument();
    });
  }
);