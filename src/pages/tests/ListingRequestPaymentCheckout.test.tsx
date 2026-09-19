import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ListingRequestPaymentCheckout from "../payments/ListingRequestPaymentCheckout";

const mocks = vi.hoisted(() => ({
  payment: null as Record<string, unknown> | null,
  createCheckout: vi.fn(),
}));

vi.mock("../../hooks/payments/useListingRequestPayments", () => ({
  useListingRequestPayment: () => ({ data: mocks.payment, isLoading: false, isError: false }),
}));

vi.mock("../../hooks/payments/useCreateListingRequestPaymentCheckout", () => ({
  useCreateListingRequestPaymentCheckout: () => ({ mutateAsync: mocks.createCheckout }),
}));

vi.mock("../../lib/stripeClient", () => ({
  getStripeForConnectedAccount: () => Promise.resolve(null),
}));

vi.mock("@stripe/react-stripe-js", () => ({
  EmbeddedCheckoutProvider: ({ children }: { children: unknown }) => <div>{children as never}</div>,
  EmbeddedCheckout: () => <div>Stripe embedded checkout</div>,
}));

// The acceptance component is tested on its own; here it only needs to
// report acceptance to the page.
vi.mock("../../components/legal/CheckoutPolicyAcceptance", () => ({
  default: ({ listingRequestId, onAccepted }: { listingRequestId: string; onAccepted: () => void }) => (
    <button type="button" onClick={onAccepted}>
      Accept for {listingRequestId}
    </button>
  ),
}));

const renderCheckout = () =>
  render(
    <MemoryRouter initialEntries={["/payments/checkout/payment-1"]}>
      <Routes>
        <Route path="/payments/checkout/:paymentId" element={<ListingRequestPaymentCheckout />} />
      </Routes>
    </MemoryRouter>,
  );

describe("ListingRequestPaymentCheckout", () => {
  beforeEach(() => {
    mocks.payment = {
      id: "payment-1",
      listing_request_id: "request-1",
      payment_type: "starting_payment",
      status: "requires_checkout",
      currency: "cad",
      base_amount_cents: 10000,
      creator_tip_cents: 0,
      buyer_service_fee_cents: 500,
      platform_support_cents: 0,
      total_checkout_cents: 10500,
      metadata: {},
    };
    mocks.createCheckout.mockReset().mockResolvedValue({
      payment: { stripe_connected_account_id: "acct_123" },
      checkout: { clientSecret: "cs_secret" },
    });
  });

  it("shows what the buyer is paying before checkout", () => {
    renderCheckout();

    expect(screen.getByText("Starting payment")).toBeInTheDocument();
    expect(screen.getByText("$100.00")).toBeInTheDocument();
    expect(screen.getByText("$5.00")).toBeInTheDocument();
    expect(screen.getByText("$105.00")).toBeInTheDocument();
  });

  it("does not create a Stripe checkout session until the policies are accepted", async () => {
    renderCheckout();

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mocks.createCheckout).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Accept for request-1" }));

    await waitFor(() => expect(mocks.createCheckout).toHaveBeenCalledWith({ paymentId: "payment-1" }));
    expect(await screen.findByText("Stripe embedded checkout")).toBeInTheDocument();
  });

  it("creates only one session when acceptance is reported more than once", async () => {
    renderCheckout();

    const accept = screen.getByRole("button", { name: "Accept for request-1" });
    fireEvent.click(accept);
    fireEvent.click(accept);

    await waitFor(() => expect(mocks.createCheckout).toHaveBeenCalledTimes(1));
  });
});
