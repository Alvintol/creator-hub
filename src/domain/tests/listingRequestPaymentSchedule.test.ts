import { describe, expect, it } from "vitest";
import { getListingRequestPaymentTypeForTiming } from "../payments/listingRequestPaymentSchedule";

describe("listing request payment schedule", () => {
  it("maps a starting payment to the Stripe payment type", () => {
    expect(
      getListingRequestPaymentTypeForTiming(
        "due_before_work_starts",
      ),
    ).toBe("starting_payment");
  });

  it("maps milestone payments to the Stripe payment type", () => {
    expect(
      getListingRequestPaymentTypeForTiming(
        "due_at_milestone_approval",
      ),
    ).toBe("milestone_payment");
  });

  it("maps final balance payments to the Stripe payment type", () => {
    expect(
      getListingRequestPaymentTypeForTiming(
        "due_before_final_release",
      ),
    ).toBe("final_balance");
  });

  it("maps change-order payments to the Stripe payment type", () => {
    expect(
      getListingRequestPaymentTypeForTiming(
        "due_on_change_order_acceptance",
      ),
    ).toBe("change_order_payment");
  });
});