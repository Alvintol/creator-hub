import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useProposeListingRequestCancellation } from "../useProposeListingRequestCancellation";

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

describe("useProposeListingRequestCancellation", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useAuth.mockReturnValue({ user: { id: "creator-1" } });

    mocks.rpc.mockResolvedValue({
      data: [
        {
          proposal_id: "proposal-1",
          status: "pending_buyer_response",
          statement_due_at: "2026-09-25T00:00:00.000Z",
        },
      ],
      error: null,
    });
  });

  it("proposes a cancellation with an itemised statement", async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useProposeListingRequestCancellation(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        requestId: "request-1",
        reason: "The buyer's plans changed.",
        items: [
          {
            paymentId: "payment-1",
            label: "Starting payment",
            earnedAmountCents: 500,
          },
        ],
      });
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "propose_listing_request_cancellation",
      {
        p_request_id: "request-1",
        p_reason: "The buyer's plans changed.",
        p_items: [
          {
            payment_id: "payment-1",
            milestone_id: null,
            label: "Starting payment",
            earned_amount_cents: 500,
            note: null,
          },
        ],
      }
    );
  });

  it("proposes a cancellation with no items when the buyer opens it", async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useProposeListingRequestCancellation(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        requestId: "request-1",
        reason: "The buyer's plans changed.",
      });
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "propose_listing_request_cancellation",
      {
        p_request_id: "request-1",
        p_reason: "The buyer's plans changed.",
        p_items: null,
      }
    );
  });

  it("throws when not signed in", async () => {
    mocks.useAuth.mockReturnValue({ user: null });

    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useProposeListingRequestCancellation(), {
      wrapper,
    });

    await expect(
      result.current.mutateAsync({
        requestId: "request-1",
        reason: "The buyer's plans changed.",
      })
    ).rejects.toThrow("You must be signed in to propose a cancellation.");
  });
});
