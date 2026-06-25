import { describe, expect, it } from "vitest";
import {
  getCreatorPaymentAccountIsReady,
  getCreatorPaymentAccountStatusLabel,
} from "../useCreatorPaymentAccount";

describe("creator payment account helpers", () => {
  it("labels a missing Stripe account as not connected", () => {
    expect(getCreatorPaymentAccountStatusLabel(null)).toBe("Not connected");
    expect(getCreatorPaymentAccountIsReady(null)).toBe(false);
  });

  it("labels incomplete onboarding", () => {
    const account = {
      details_submitted: false,
      charges_enabled: false,
      payouts_enabled: false,
    };

    expect(getCreatorPaymentAccountStatusLabel(account)).toBe(
      "Onboarding incomplete",
    );
    expect(getCreatorPaymentAccountIsReady(account)).toBe(false);
  });

  it("labels submitted accounts waiting for Stripe review", () => {
    const account = {
      details_submitted: true,
      charges_enabled: false,
      payouts_enabled: false,
    };

    expect(getCreatorPaymentAccountStatusLabel(account)).toBe(
      "Stripe review pending",
    );
    expect(getCreatorPaymentAccountIsReady(account)).toBe(false);
  });

  it("labels fully enabled accounts as ready", () => {
    const account = {
      details_submitted: true,
      charges_enabled: true,
      payouts_enabled: true,
    };

    expect(getCreatorPaymentAccountStatusLabel(account)).toBe(
      "Ready for payouts",
    );
    expect(getCreatorPaymentAccountIsReady(account)).toBe(true);
  });
});