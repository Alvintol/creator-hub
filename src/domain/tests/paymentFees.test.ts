import { describe, expect, it } from "vitest";
import { getCreatorHubPaymentFeeBreakdown } from "../payments/paymentFees";

describe("CreatorHub payment fees", () => {
  it("applies the approved minimum fees for low-price payments", () => {
    const fees = getCreatorHubPaymentFeeBreakdown({
      baseAmountCents: 1_500,
    });

    expect(fees.buyerServiceFeeCents).toBe(100);
    expect(fees.creatorPlatformFeeCents).toBe(150);
    expect(fees.applicationFeeCents).toBe(250);
    expect(fees.totalCheckoutCents).toBe(1_600);
    expect(fees.creatorNetBeforeStripeCents).toBe(1_350);
  });

  it("applies 5 percent fees once the percentage exceeds the minimums", () => {
    const fees = getCreatorHubPaymentFeeBreakdown({
      baseAmountCents: 10_000,
    });

    expect(fees.buyerServiceFeeCents).toBe(500);
    expect(fees.creatorPlatformFeeCents).toBe(500);
    expect(fees.applicationFeeCents).toBe(1_000);
    expect(fees.totalCheckoutCents).toBe(10_500);
    expect(fees.creatorNetBeforeStripeCents).toBe(9_500);
  });

  it("does not calculate buyer or creator fees on creator tips", () => {
    const withoutTip = getCreatorHubPaymentFeeBreakdown({
      baseAmountCents: 2_000,
    });

    const withTip = getCreatorHubPaymentFeeBreakdown({
      baseAmountCents: 2_000,
      creatorTipCents: 500,
    });

    expect(withTip.buyerServiceFeeCents).toBe(
      withoutTip.buyerServiceFeeCents,
    );
    expect(withTip.creatorPlatformFeeCents).toBe(
      withoutTip.creatorPlatformFeeCents,
    );
    expect(withTip.totalCheckoutCents).toBe(2_000 + 500 + 100);
    expect(withTip.creatorGrossCents).toBe(2_500);
    expect(withTip.creatorNetBeforeStripeCents).toBe(2_350);
  });

  it("keeps optional CreatorHub support separate from buyer service fees", () => {
    const fees = getCreatorHubPaymentFeeBreakdown({
      baseAmountCents: 2_000,
      platformSupportCents: 200,
    });

    expect(fees.buyerServiceFeeCents).toBe(100);
    expect(fees.creatorPlatformFeeCents).toBe(150);
    expect(fees.platformSupportCents).toBe(200);
    expect(fees.applicationFeeCents).toBe(450);
    expect(fees.totalCheckoutCents).toBe(2_300);
  });

  it("supports the future subscriber creator fee reduction without changing buyer fees", () => {
    const fees = getCreatorHubPaymentFeeBreakdown({
      baseAmountCents: 1_500,
      creatorPlatformFeeBps: 300,
      creatorPlatformFeeMinimumCents: 75,
    });

    expect(fees.buyerServiceFeeCents).toBe(100);
    expect(fees.creatorPlatformFeeCents).toBe(75);
    expect(fees.applicationFeeCents).toBe(175);
    expect(fees.totalCheckoutCents).toBe(1_600);
    expect(fees.creatorNetBeforeStripeCents).toBe(1_425);
  });

  it("rejects invalid amounts", () => {
    expect(() =>
      getCreatorHubPaymentFeeBreakdown({
        baseAmountCents: 0,
      }),
    ).toThrow("Base amount must be greater than zero.");

    expect(() =>
      getCreatorHubPaymentFeeBreakdown({
        baseAmountCents: 1_500.5,
      }),
    ).toThrow("Base amount must be a whole-cent amount.");
  });
});