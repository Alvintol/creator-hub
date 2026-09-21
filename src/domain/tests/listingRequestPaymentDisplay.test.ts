import { describe, expect, it } from "vitest";

import {
  canOpenListingRequestPaymentCheckout,
  formatPaymentCents,
  getListingRequestPaymentActionLabel,
  getListingRequestPaymentStatusLabel,
  getListingRequestPaymentTypeLabel,
} from "../payments/listingRequestPaymentDisplay";

describe("listing request payment display", () => {
  it.each([
    [12345, "cad", "$123.45"],
    [12345, "USD", "US$123.45"],
    [0, "cad", "$0.00"],
    [-1050, "cad", "-$10.50"],
    [1, "cad", "$0.01"],
  ])("formats %s minor units in %s as %s", (cents, currency, expected) => {
    expect(formatPaymentCents(cents, currency)).toBe(expected);
  });

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
