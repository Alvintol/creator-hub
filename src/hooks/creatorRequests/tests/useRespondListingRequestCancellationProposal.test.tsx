import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRespondListingRequestCancellationProposal } from "../useRespondListingRequestCancellationProposal";

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
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { wrapper };
};

describe("useRespondListingRequestCancellationProposal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    );

    mocks.useAuth.mockReturnValue({
      user: { id: "buyer-1" },
      session: { access_token: "token-123" },
    });
  });

  it("accepts a cancellation proposal and expires open sessions", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          proposal_id: "proposal-1",
          status: "accepted",
          request_status: "cancelled",
          payments_to_expire: ["payment-2"],
        },
      ],
      error: null,
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useRespondListingRequestCancellationProposal(),
      { wrapper }
    );

    await act(async () => {
      await result.current.mutateAsync({
        proposalId: "proposal-1",
        requestId: "request-1",
        response: "accepted",
      });
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "respond_listing_request_cancellation_proposal",
      {
        p_proposal_id: "proposal-1",
        p_response: "accepted",
        p_response_reason: null,
      }
    );

    expect(fetch).toHaveBeenCalled();
  });

  it("disputes a cancellation proposal with a reason", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          proposal_id: "proposal-1",
          status: "disputed",
          request_status: "accepted",
          payments_to_expire: [],
        },
      ],
      error: null,
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useRespondListingRequestCancellationProposal(),
      { wrapper }
    );

    await act(async () => {
      await result.current.mutateAsync({
        proposalId: "proposal-1",
        requestId: "request-1",
        response: "disputed",
        disputeReason: "The itemised statement understates the work delivered.",
      });
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "respond_listing_request_cancellation_proposal",
      {
        p_proposal_id: "proposal-1",
        p_response: "disputed",
        p_response_reason: "The itemised statement understates the work delivered.",
      }
    );

    expect(fetch).not.toHaveBeenCalled();
  });

  it("throws when not signed in", async () => {
    mocks.useAuth.mockReturnValue({ user: null, session: null });

    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useRespondListingRequestCancellationProposal(),
      { wrapper }
    );

    await expect(
      result.current.mutateAsync({
        proposalId: "proposal-1",
        requestId: "request-1",
        response: "accepted",
      })
    ).rejects.toThrow(
      "You must be signed in to respond to a cancellation proposal."
    );
  });
});
