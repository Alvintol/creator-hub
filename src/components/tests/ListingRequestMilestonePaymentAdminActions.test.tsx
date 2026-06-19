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

    it("explains when no milestone payment is required", () => {
      render(
        <ListingRequestMilestonePaymentAdminActions
          milestones={[
            createMilestone({
              status: "pending",
            }),
          ]}
          onConfirmPayment={onConfirmPayment}
        />
      );

      expect(
        screen.getByRole("heading", {
          name: "No milestone payment to confirm",
        })
      ).toBeInTheDocument();

      expect(
        screen.getByText(
          "Milestone 1: Initial design direction is waiting for creator submission."
        )
      ).toBeInTheDocument();

      expect(
        screen.queryByRole("button", {
          name: "Confirm milestone payment",
        })
      ).not.toBeInTheDocument();
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

    it("explains when milestone payment is waiting for buyer review", () => {
      render(
        <ListingRequestMilestonePaymentAdminActions
          milestones={[
            createMilestone({
              status: "submitted",
            }),
          ]}
          onConfirmPayment={onConfirmPayment}
        />
      );

      expect(
        screen.getByText(
          "Milestone 1: Initial design direction is waiting for buyer review before payment is required."
        )
      ).toBeInTheDocument();
    });

    it("explains when all milestone payments have been confirmed", () => {
      render(
        <ListingRequestMilestonePaymentAdminActions
          milestones={[
            createMilestone({
              status: "paid",
              paid_at: "2026-06-18T14:00:00.000Z",
            }),
          ]}
          onConfirmPayment={onConfirmPayment}
        />
      );

      expect(
        screen.getByText(
          "All milestone payments have been confirmed."
        )
      ).toBeInTheDocument();
    });
  }
);