import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CREATOR_PAYMENT_ACCOUNT_REQUIRED_MESSAGE,
  requireCreatorPaymentAccountReadyForPublishing,
} from "../listingPaymentAccountGuards";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    from: mocks.from,
    rpc: mocks.rpc,
  },
}));

const mockListing = (
  data: { is_free: boolean } | null,
  error: unknown = null,
) => {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve({ data, error })),
  };

  mocks.from.mockReturnValue(chain);

  return chain;
};

describe("requireCreatorPaymentAccountReadyForPublishing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows a free listing without a connected account", async () => {
    mockListing({ is_free: true });
    mocks.rpc.mockResolvedValue({ data: false, error: null });

    await expect(
      requireCreatorPaymentAccountReadyForPublishing("user-1", "listing-1"),
    ).resolves.toBeUndefined();

    // A free listing never takes a payment, so readiness is not consulted at all.
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("requires a ready account for a paid listing", async () => {
    mockListing({ is_free: false });
    mocks.rpc.mockResolvedValue({ data: false, error: null });

    await expect(
      requireCreatorPaymentAccountReadyForPublishing("user-1", "listing-1"),
    ).rejects.toThrow(CREATOR_PAYMENT_ACCOUNT_REQUIRED_MESSAGE);
  });

  it("allows a paid listing when the account is ready", async () => {
    mockListing({ is_free: false });
    mocks.rpc.mockResolvedValue({ data: true, error: null });

    await expect(
      requireCreatorPaymentAccountReadyForPublishing("user-1", "listing-1"),
    ).resolves.toBeUndefined();
  });

  it("checks readiness when the listing cannot be read", async () => {
    // Not finding the row must not be mistaken for a free listing.
    mockListing(null);
    mocks.rpc.mockResolvedValue({ data: false, error: null });

    await expect(
      requireCreatorPaymentAccountReadyForPublishing("user-1", "listing-1"),
    ).rejects.toThrow(CREATOR_PAYMENT_ACCOUNT_REQUIRED_MESSAGE);
  });

  it("surfaces a listing read failure instead of skipping the check", async () => {
    mockListing(null, new Error("network"));
    mocks.rpc.mockResolvedValue({ data: true, error: null });

    await expect(
      requireCreatorPaymentAccountReadyForPublishing("user-1", "listing-1"),
    ).rejects.toThrow("network");

    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("scopes the listing read to the acting creator", async () => {
    const chain = mockListing({ is_free: true });

    await requireCreatorPaymentAccountReadyForPublishing("user-1", "listing-1");

    expect(chain.eq).toHaveBeenCalledWith("id", "listing-1");
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1");
  });
});
