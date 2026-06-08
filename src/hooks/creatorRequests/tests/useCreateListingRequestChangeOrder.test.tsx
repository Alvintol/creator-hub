import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { useCreateListingRequestChangeOrder } from "../useCreateListingRequestChangeOrder";

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

  const invalidateSpy = vi.spyOn(
    queryClient,
    "invalidateQueries"
  );

  const wrapper = ({
    children,
  }: {
    children: ReactNode;
  }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  return {
    wrapper,
    invalidateSpy,
  };
};

describe("useCreateListingRequestChangeOrder", () => {
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
          id: "change-order-1",
          listing_request_id: "request-1",
          agreement_id: "agreement-1",
          status: "sent",
          version_number: 1,
          sent_at: "2026-06-08T12:00:00.000Z",
        },
      ],
      error: null,
    });
  });

  it("creates and sends a project change order", async () => {
    const { wrapper, invalidateSpy } = createWrapper();

    const { result } = renderHook(
      () => useCreateListingRequestChangeOrder(),
      {
        wrapper,
      }
    );

    await act(async () => {
      await result.current.mutateAsync({
        agreementId: "agreement-1",
        status: "sent",
        title: " Additional animated overlay ",
        summary:
          " Add one animated overlay and extend delivery by five days. ",
        changesScope: true,
        changesPrice: true,
        changesTimeline: true,
        changesDeliverables: true,
        changesPaymentSchedule: false,
        changesMilestones: false,
        revisedTotalAmount: 450,
        revisedCompletionAt:
          "2026-06-25T12:00:00.000Z",
        proposedSnapshot: {
          scope_summary:
            "Add one animated overlay to the project scope.",
          included_deliverables: [
            "Original overlay package",
            "One animated overlay",
          ],
        },
      });
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "create_listing_request_change_order",
      {
        p_agreement_id: "agreement-1",
        p_status: "sent",
        p_title: "Additional animated overlay",
        p_summary:
          "Add one animated overlay and extend delivery by five days.",
        p_changes_scope: true,
        p_changes_price: true,
        p_changes_timeline: true,
        p_changes_deliverables: true,
        p_changes_payment_schedule: false,
        p_changes_milestones: false,
        p_revised_total_amount: 450,
        p_revised_completion_at:
          "2026-06-25T12:00:00.000Z",
        p_proposed_snapshot: {
          scope_summary:
            "Add one animated overlay to the project scope.",
          included_deliverables: [
            "Original overlay package",
            "One animated overlay",
          ],
        },
      }
    );

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [
        "listingRequestChangeOrders",
        "request-1",
      ],
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["creatorRequest", "request-1"],
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["buyerRequest", "request-1"],
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["adminRequest", "request-1"],
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["conversationMessages"],
    });
  });

  it("creates a draft without sending optional price or timeline values", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          id: "change-order-1",
          listing_request_id: "request-1",
          agreement_id: "agreement-1",
          status: "draft",
          version_number: 1,
          sent_at: null,
        },
      ],
      error: null,
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useCreateListingRequestChangeOrder(),
      {
        wrapper,
      }
    );

    await act(async () => {
      await result.current.mutateAsync({
        agreementId: "agreement-1",
        status: "draft",
        title: "Additional revision",
        summary:
          "Add one extra revision round to the accepted project.",
        changesScope: true,
        changesPrice: false,
        changesTimeline: false,
        changesDeliverables: false,
        changesPaymentSchedule: false,
        changesMilestones: false,
        revisedTotalAmount: 999,
        revisedCompletionAt:
          "2026-12-01T12:00:00.000Z",
        proposedSnapshot: {
          included_revision_count: 3,
        },
      });
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "create_listing_request_change_order",
      expect.objectContaining({
        p_status: "draft",
        p_revised_total_amount: null,
        p_revised_completion_at: null,
      })
    );
  });

  it("throws when the creator is not signed in", async () => {
    mocks.useAuth.mockReturnValue({
      user: null,
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useCreateListingRequestChangeOrder(),
      {
        wrapper,
      }
    );

    await expect(
      result.current.mutateAsync({
        agreementId: "agreement-1",
        status: "draft",
        title: "Additional revision",
        summary:
          "Add one extra revision round to the project.",
        changesScope: true,
        changesPrice: false,
        changesTimeline: false,
        changesDeliverables: false,
        changesPaymentSchedule: false,
        changesMilestones: false,
        proposedSnapshot: {
          included_revision_count: 3,
        },
      })
    ).rejects.toThrow(
      "You must be signed in to create a change order."
    );

    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("surfaces RPC errors", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: new Error(
        "This agreement already has a pending change order."
      ),
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useCreateListingRequestChangeOrder(),
      {
        wrapper,
      }
    );

    await expect(
      result.current.mutateAsync({
        agreementId: "agreement-1",
        status: "sent",
        title: "Additional revision",
        summary:
          "Add one extra revision round to the project.",
        changesScope: true,
        changesPrice: false,
        changesTimeline: false,
        changesDeliverables: false,
        changesPaymentSchedule: false,
        changesMilestones: false,
        proposedSnapshot: {
          included_revision_count: 3,
        },
      })
    ).rejects.toThrow(
      "This agreement already has a pending change order."
    );
  });

  it("throws when the RPC returns no change order", async () => {
    mocks.rpc.mockResolvedValue({
      data: [],
      error: null,
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useCreateListingRequestChangeOrder(),
      {
        wrapper,
      }
    );

    await expect(
      result.current.mutateAsync({
        agreementId: "agreement-1",
        status: "draft",
        title: "Additional revision",
        summary:
          "Add one extra revision round to the project.",
        changesScope: true,
        changesPrice: false,
        changesTimeline: false,
        changesDeliverables: false,
        changesPaymentSchedule: false,
        changesMilestones: false,
        proposedSnapshot: {
          included_revision_count: 3,
        },
      })
    ).rejects.toThrow(
      "The project change order could not be created."
    );
  });
});