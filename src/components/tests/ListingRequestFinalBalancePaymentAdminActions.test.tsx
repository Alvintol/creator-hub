import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import ListingRequestFinalBalancePaymentAdminActions from "../ListingRequestFinalBalancePaymentAdminActions";
import type { ListingRequestAgreementRow } from "../../hooks/creatorRequests/useListingRequestAgreement";

const createAgreement = (
  paymentOverrides?: Partial<
    ListingRequestAgreementRow["listing_request_payment_schedule_items"][number]
  >
): Pick<
  ListingRequestAgreementRow,
  "listing_request_payment_schedule_items"
> => ({
  listing_request_payment_schedule_items: [
    {
      id: "payment-3",
      agreement_id: "agreement-1",
      change_order_id: null,
      title: "Final project balance",
      description:
        "Required before the final delivery can be approved.",
      amount: 150,
      currency: "cad",
      payment_timing: "due_before_final_release",
      status: "payment_required",
      due_at: "2026-06-09T12:00:00.000Z",
      paid_at: null,
      sort_order: 3,
      created_at: "2026-06-09T12:00:00.000Z",
      updated_at: "2026-06-09T12:00:00.000Z",
      ...paymentOverrides,
    },
  ],
});

describe(
  "ListingRequestFinalBalancePaymentAdminActions",
  () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("does not render without an agreement", () => {
      render(
        <ListingRequestFinalBalancePaymentAdminActions
          agreement={null}
          onConfirmPayment={vi.fn()}
        />
      );

      expect(
        screen.queryByText(
          "Final-balance payment confirmation"
        )
      ).not.toBeInTheDocument();
    });

    it("does not render when the final balance is already paid", () => {
      render(
        <ListingRequestFinalBalancePaymentAdminActions
          agreement={createAgreement({
            status: "paid",
            paid_at:
              "2026-06-09T13:00:00.000Z",
          })}
          onConfirmPayment={vi.fn()}
        />
      );

      expect(
        screen.queryByRole("button", {
          name: "Confirm final-balance payment",
        })
      ).not.toBeInTheDocument();
    });

    it("does not render for a different payment timing", () => {
      render(
        <ListingRequestFinalBalancePaymentAdminActions
          agreement={createAgreement({
            payment_timing:
              "due_on_change_order_acceptance",
          })}
          onConfirmPayment={vi.fn()}
        />
      );

      expect(
        screen.queryByText(
          "Final-balance payment confirmation"
        )
      ).not.toBeInTheDocument();
    });

    it("does not render zero-value final payments", () => {
      render(
        <ListingRequestFinalBalancePaymentAdminActions
          agreement={createAgreement({
            amount: 0,
          })}
          onConfirmPayment={vi.fn()}
        />
      );

      expect(
        screen.queryByRole("button", {
          name: "Confirm final-balance payment",
        })
      ).not.toBeInTheDocument();
    });

    it("renders pending final-balance payments", () => {
      render(
        <ListingRequestFinalBalancePaymentAdminActions
          agreement={createAgreement()}
          onConfirmPayment={vi.fn()}
        />
      );

      expect(
        screen.getByText(
          "Final-balance payment confirmation"
        )
      ).toBeInTheDocument();

      expect(
        screen.getByText("Final project balance")
      ).toBeInTheDocument();

      expect(
        screen.getByText("$150.00")
      ).toBeInTheDocument();
    });

    it("confirms a final-balance payment after admin confirmation", () => {
      const onConfirmPayment = vi.fn();

      vi.spyOn(window, "confirm").mockReturnValue(
        true
      );

      render(
        <ListingRequestFinalBalancePaymentAdminActions
          agreement={createAgreement()}
          onConfirmPayment={onConfirmPayment}
        />
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: "Confirm final-balance payment",
        })
      );

      expect(window.confirm).toHaveBeenCalledWith(
        'Confirm that the final-balance payment "Final project balance" has been independently verified as paid?'
      );

      expect(
        onConfirmPayment
      ).toHaveBeenCalledWith("payment-3");
    });

    it("does not confirm when the admin cancels", () => {
      const onConfirmPayment = vi.fn();

      vi.spyOn(window, "confirm").mockReturnValue(
        false
      );

      render(
        <ListingRequestFinalBalancePaymentAdminActions
          agreement={createAgreement()}
          onConfirmPayment={onConfirmPayment}
        />
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: "Confirm final-balance payment",
        })
      );

      expect(
        onConfirmPayment
      ).not.toHaveBeenCalled();
    });

    it("disables confirmation while pending", () => {
      render(
        <ListingRequestFinalBalancePaymentAdminActions
          agreement={createAgreement()}
          isPending
          onConfirmPayment={vi.fn()}
        />
      );

      expect(
        screen.getByRole("button", {
          name: "Confirming payment…",
        })
      ).toBeDisabled();
    });

    it("renders confirmation errors", () => {
      render(
        <ListingRequestFinalBalancePaymentAdminActions
          agreement={createAgreement()}
          error={
            new Error(
              "Only an administrator can confirm a final-balance payment."
            )
          }
          onConfirmPayment={vi.fn()}
        />
      );

      expect(
        screen.getByText(
          "Only an administrator can confirm a final-balance payment."
        )
      ).toBeInTheDocument();
    });
  }
);