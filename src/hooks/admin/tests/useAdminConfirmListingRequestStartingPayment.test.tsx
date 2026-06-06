import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAdminConfirmListingRequestStartingPayment } from "../useAdminConfirmListingRequestStartingPayment";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    rpc: mocks.rpc,
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return {
    wrapper,
    invalidateSpy,
  };
};

describe("useAdminConfirmListingRequestStartingPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.rpc.mockResolvedValue({
      data: [
        {
          agreement_id: "agreement-1",
          listing_request_id: "request-1",
          starting_payment_status: "paid",
          paid_at: "2026-06-06T12:00:00.000Z",
        },
      ],
      error: null,
    });
  });

  it("confirms the starting payment through the admin RPC", async () => {
    const { wrapper, invalidateSpy } = createWrapper();

    const { result } = renderHook(
      () => useAdminConfirmListingRequestStartingPayment(),
      {
        wrapper,
      }
    );

    await act(async () => {
      await result.current.mutateAsync({
        agreementId: "agreement-1",
      });
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "admin_confirm_listing_request_starting_payment",
      {
        p_agreement_id: "agreement-1",
      }
    );

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["listingRequestAgreements"],
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["adminRequest", "request-1"],
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["buyerRequest", "request-1"],
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["creatorRequest", "request-1"],
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["conversationMessages"],
    });
  });

  it("surfaces RPC errors", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: {
        message: "Only an administrator can confirm a starting payment.",
      },
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useAdminConfirmListingRequestStartingPayment(),
      {
        wrapper,
      }
    );

    await expect(
      result.current.mutateAsync({
        agreementId: "agreement-1",
      })
    ).rejects.toThrow(
      "Only an administrator can confirm a starting payment."
    );
  });

  it("throws when the RPC returns no confirmation row", async () => {
    mocks.rpc.mockResolvedValue({
      data: [],
      error: null,
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useAdminConfirmListingRequestStartingPayment(),
      {
        wrapper,
      }
    );

    await expect(
      result.current.mutateAsync({
        agreementId: "agreement-1",
      })
    ).rejects.toThrow("The starting payment could not be confirmed.");
  });
});