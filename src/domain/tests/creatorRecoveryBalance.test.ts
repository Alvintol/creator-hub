import { describe, expect, it } from "vitest";

import { resolveRecoveryInstalmentCents } from "../payments/creatorRecoveryBalance";

describe("resolveRecoveryInstalmentCents", () => {
  it("returns zero when there is no outstanding balance", () => {
    expect(resolveRecoveryInstalmentCents(10000, 0)).toBe(0);
  });

  it("caps the instalment at 50% of the base payment", () => {
    // A large balance still only takes half of a single payment's base.
    expect(resolveRecoveryInstalmentCents(10000, 1_000_000)).toBe(5000);
  });

  it("takes the whole remaining balance when it is under the 50% cap", () => {
    expect(resolveRecoveryInstalmentCents(10000, 1000)).toBe(1000);
  });

  it("recovers a balance fully across several payments, respecting the cap each time", () => {
    let outstanding = 12000;

    // Payment 1: base 10000, cap 5000 -> takes 5000, leaves 7000.
    const first = resolveRecoveryInstalmentCents(10000, outstanding);
    expect(first).toBe(5000);
    outstanding -= first;
    expect(outstanding).toBe(7000);

    // Payment 2: base 10000, cap 5000 -> takes 5000, leaves 2000.
    const second = resolveRecoveryInstalmentCents(10000, outstanding);
    expect(second).toBe(5000);
    outstanding -= second;
    expect(outstanding).toBe(2000);

    // Payment 3: base 10000, cap 5000, but only 2000 remains -> takes 2000, releases.
    const third = resolveRecoveryInstalmentCents(10000, outstanding);
    expect(third).toBe(2000);
    outstanding -= third;
    expect(outstanding).toBe(0);
  });

  it("rounds the 50% cap down when the base is an odd number of cents", () => {
    expect(resolveRecoveryInstalmentCents(10001, 1_000_000)).toBe(5000);
  });
});
