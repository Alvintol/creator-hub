import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ListingRequestAgreementAdminPaymentActions from "../ListingRequestAgreementAdminPaymentActions";

const agreement = {
  id: "agreement-1",
  status: "buyer_accepted" as const,
  starting_payment_status: "payment_required" as const,
  payment_structure: "deposit_balance" as const,
  deposit_amount: 100,
  total_amount: 300,
  currency: "cad",
};

describe("ListingRequestAgreementAdminPaymentActions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not render without an agreement", () => {
    render(
      <ListingRequestAgreementAdminPaymentActions
        agreement={null}
        onConfirmPayment={vi.fn()}
      />
    );

    expect(
      screen.queryByText("Starting payment confirmation")
    ).not.toBeInTheDocument();
  });

  it("does not render before the buyer accepts the agreement", () => {
    render(
      <ListingRequestAgreementAdminPaymentActions
        agreement={{
          ...agreement,
          status: "sent",
        }}
        onConfirmPayment={vi.fn()}
      />
    );

    expect(
      screen.queryByText("Starting payment confirmation")
    ).not.toBeInTheDocument();
  });

  it("does not render when the starting payment is already paid", () => {
    render(
      <ListingRequestAgreementAdminPaymentActions
        agreement={{
          ...agreement,
          starting_payment_status: "paid",
        }}
        onConfirmPayment={vi.fn()}
      />
    );

    expect(
      screen.queryByRole("button", {
        name: "Confirm starting payment",
      })
    ).not.toBeInTheDocument();
  });

  it("shows the starting payment amount", () => {
    render(
      <ListingRequestAgreementAdminPaymentActions
        agreement={agreement}
        onConfirmPayment={vi.fn()}
      />
    );

    expect(
      screen.getByText("Starting payment confirmation")
    ).toBeInTheDocument();

    expect(screen.getByText("Deposit + balance")).toBeInTheDocument();
    expect(screen.getByText("$100.00")).toBeInTheDocument();
  });

  it("confirms the starting payment after admin confirmation", () => {
    const onConfirmPayment = vi.fn();

    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <ListingRequestAgreementAdminPaymentActions
        agreement={agreement}
        onConfirmPayment={onConfirmPayment}
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Confirm starting payment",
      })
    );

    expect(window.confirm).toHaveBeenCalledWith(
      "Confirm that the required starting payment has been independently verified as paid? This will allow work to begin."
    );

    expect(onConfirmPayment).toHaveBeenCalledWith("agreement-1");
  });

  it("does not confirm the payment when the admin cancels", () => {
    const onConfirmPayment = vi.fn();

    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <ListingRequestAgreementAdminPaymentActions
        agreement={agreement}
        onConfirmPayment={onConfirmPayment}
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Confirm starting payment",
      })
    );

    expect(onConfirmPayment).not.toHaveBeenCalled();
  });

  it("disables the confirmation action while pending", () => {
    render(
      <ListingRequestAgreementAdminPaymentActions
        agreement={agreement}
        isPending
        onConfirmPayment={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", {
        name: "Confirming starting payment…",
      })
    ).toBeDisabled();
  });

  it("renders confirmation errors", () => {
    render(
      <ListingRequestAgreementAdminPaymentActions
        agreement={agreement}
        error={new Error("Payment verification failed.")}
        onConfirmPayment={vi.fn()}
      />
    );

    expect(
      screen.getByText("Payment verification failed.")
    ).toBeInTheDocument();
  });
});