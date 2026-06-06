import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSendDraftListingRequestAgreement } from "../useSendDraftListingRequestAgreement";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("../../../providers/AuthProvider", () => ({
  useAuth: mocks.useAuth,
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

describe("useSendDraftListingRequestAgreement", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useAuth.mockReturnValue({
      user: {
        id: "creator-1",
      },
    });

    mocks.rpc.mockResolvedValue({
      data: [
        {
          id: "agreement-1",
          status: "sent",
          sent_at: "2026-05-25T12:00:00.000Z",
        },
      ],
      error: null,
    });
  });

  it("sends a draft project agreement through the focused RPC", async () => {
    const { wrapper, invalidateSpy } = createWrapper();

    const { result } = renderHook(
      () => useSendDraftListingRequestAgreement(),
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
      "send_draft_listing_request_agreement",
      {
        p_agreement_id: "agreement-1",
      }
    );

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["listingRequestAgreements"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["creatorRequest"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["buyerRequest"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["messagesInbox"],
    });
  });

  it("throws when the creator is not signed in", async () => {
    mocks.useAuth.mockReturnValue({
      user: null,
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useSendDraftListingRequestAgreement(),
      {
        wrapper,
      }
    );

    await expect(
      result.current.mutateAsync({
        agreementId: "agreement-1",
      })
    ).rejects.toThrow("You must be signed in to send this project agreement.");

    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("throws when the RPC returns no agreement", async () => {
    mocks.rpc.mockResolvedValue({
      data: [],
      error: null,
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useSendDraftListingRequestAgreement(),
      {
        wrapper,
      }
    );

    await expect(
      result.current.mutateAsync({
        agreementId: "agreement-1",
      })
    ).rejects.toThrow("The project agreement could not be sent.");
  });
});