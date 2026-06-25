import { describe, expect, it } from "vitest";
import { getStripePublishableKeyMissingMessage } from "../stripeClient";

describe("stripeClient", () => {
  it("provides a friendly missing publishable key message", () => {
    expect(getStripePublishableKeyMissingMessage()).toBe(
      "Stripe publishable key is not configured.",
    );
  });
});