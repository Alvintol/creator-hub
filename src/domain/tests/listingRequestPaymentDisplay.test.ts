import { describe, expect, it } from "vitest";

import {
  canOpenListingRequestPaymentCheckout,
  getListingRequestPaymentActionLabel,
  getListingRequestPaymentStatusLabel,
  getListingRequestPaymentTypeLabel,
} from "../payments/listingRequestPaymentDisplay";

describe("listing request payment display", () => {
  it("labels milestone payments", () => {
    expect(
      getListingRequestPaymentTypeLabel(
        "milestone_payment",
      ),
    ).toBe("Milestone payment");
  });

  it("shows Pay now for a new checkout", () => {
    expect(
      getListingRequestPaymentActionLabel(
        "requires_checkout",
      ),
    ).toBe("Pay now");
  });

  it("shows Continue payment after checkout has started", () => {
    expect(
      getListingRequestPaymentActionLabel(
        "checkout_opened",
      ),
    ).toBe("Continue payment");
  });

  it("shows Retry payment after a failed payment", () => {
    expect(
      getListingRequestPaymentActionLabel("failed"),
    ).toBe("Retry payment");
  });

  it("does not expose checkout for paid payments", () => {
    expect(
      canOpenListingRequestPaymentCheckout({
        status: "paid",
      }),
    ).toBe(false);
  });

  it("allows checkout for payment-required rows", () => {
    expect(
      canOpenListingRequestPaymentCheckout({
        status: "requires_checkout",
      }),
    ).toBe(true);
  });

  it("labels processing payments", () => {
    expect(
      getListingRequestPaymentStatusLabel("processing"),
    ).toBe("Processing");
  });
});