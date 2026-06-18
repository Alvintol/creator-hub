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

import ListingRequestChangeOrderPaymentAdminActions from "../listingRequests/payments/ListingRequestChangeOrderPaymentAdminActions";
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
      id: "payment-1",
      agreement_id: "agreement-1",
      change_order_id: "change-order-1",
      title: "Change order: Additional animated overlay",
      description:
        "Additional payment required after accepting change order version 1.",
      amount: 150,
      currency: "cad",
      payment_timing: "due_on_change_order_acceptance",
      status: "payment_required",
      due_at: "2026-06-08T12:00:00.000Z",
      paid_at: null,
      sort_order: 2,
      created_at: "2026-06-08T12:00:00.000Z",
      updated_at: "2026-06-08T12:00:00.000Z",
      ...paymentOverrides,
    },
  ],
});

describe("ListingRequestChangeOrderPaymentAdminActions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not render without an agreement", () => {
    render(
      <ListingRequestChangeOrderPaymentAdminActions
        agreement={null}
        onConfirmPayment={vi.fn()}
      />
    );

    expect(
      screen.queryByText(
        "Change-order payment confirmation"
      )
    ).not.toBeInTheDocument();
  });

  it("does not render when there are no pending change-order payments", () => {
    render(
      <ListingRequestChangeOrderPaymentAdminActions
        agreement={createAgreement({
          status: "paid",
          paid_at: "2026-06-08T13:00:00.000Z",
        })}
        onConfirmPayment={vi.fn()}
      />
    );

    expect(
      screen.queryByRole("button", {
        name: "Confirm change-order payment",
      })
    ).not.toBeInTheDocument();
  });

  it("does not render for non-change-order payment items", () => {
    render(
      <ListingRequestChangeOrderPaymentAdminActions
        agreement={createAgreement({
          change_order_id: null,
          payment_timing: "due_before_final_release",
        })}
        onConfirmPayment={vi.fn()}
      />
    );

    expect(
      screen.queryByText(
        "Change-order payment confirmation"
      )
    ).not.toBeInTheDocument();
  });

  it("renders pending change-order payments", () => {
    render(
      <ListingRequestChangeOrderPaymentAdminActions
        agreement={createAgreement()}
        onConfirmPayment={vi.fn()}
      />
    );

    expect(
      screen.getByText(
        "Change-order payment confirmation"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Change order: Additional animated overlay"
      )
    ).toBeInTheDocument();

    expect(screen.getByText("$150.00")).toBeInTheDocument();
  });

  it("confirms a payment after admin confirmation", () => {
    const onConfirmPayment = vi.fn();

    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <ListingRequestChangeOrderPaymentAdminActions
        agreement={createAgreement()}
        onConfirmPayment={onConfirmPayment}
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Confirm change-order payment",
      })
    );

    expect(window.confirm).toHaveBeenCalledWith(
      'Confirm that the change-order payment "Change order: Additional animated overlay" has been independently verified as paid?'
    );

    expect(onConfirmPayment).toHaveBeenCalledWith(
      "payment-1"
    );
  });

  it("does not confirm when the admin cancels", () => {
    const onConfirmPayment = vi.fn();

    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <ListingRequestChangeOrderPaymentAdminActions
        agreement={createAgreement()}
        onConfirmPayment={onConfirmPayment}
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Confirm change-order payment",
      })
    );

    expect(onConfirmPayment).not.toHaveBeenCalled();
  });

  it("disables confirmation while pending", () => {
    render(
      <ListingRequestChangeOrderPaymentAdminActions
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
      <ListingRequestChangeOrderPaymentAdminActions
        agreement={createAgreement()}
        error={
          new Error(
            "Only an administrator can confirm a change-order payment."
          )
        }
        onConfirmPayment={vi.fn()}
      />
    );

    expect(
      screen.getByText(
        "Only an administrator can confirm a change-order payment."
      )
    ).toBeInTheDocument();
  });
});