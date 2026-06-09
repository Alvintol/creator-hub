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

import {
  useCreateListingRequestFinalDelivery,
} from "../useCreateListingRequestFinalDelivery";

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

describe("useCreateListingRequestFinalDelivery", () => {
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
          id: "final-delivery-1",
          listing_request_id: "request-1",
          agreement_id: "agreement-1",
          status: "submitted",
          version_number: 1,
          submitted_at:
            "2026-06-09T12:00:00.000Z",
        },
      ],
      error: null,
    });
  });

  it("creates and submits a final delivery", async () => {
    const { wrapper, invalidateSpy } =
      createWrapper();

    const { result } = renderHook(
      () => useCreateListingRequestFinalDelivery(),
      {
        wrapper,
      }
    );

    await act(async () => {
      await result.current.mutateAsync({
        agreementId: "agreement-1",
        status: "submitted",
        title: " Final overlay delivery ",
        summary:
          " The completed overlay package is ready for buyer review. ",
        deliveryLinks: [
          " https://example.com/final-overlay ",
          "",
          "https://example.com/source-files",
        ],
      });
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "create_listing_request_final_delivery",
      {
        p_agreement_id: "agreement-1",
        p_status: "submitted",
        p_title: "Final overlay delivery",
        p_summary:
          "The completed overlay package is ready for buyer review.",
        p_delivery_links: [
          "https://example.com/final-overlay",
          "https://example.com/source-files",
        ],
      }
    );

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [
        "listingRequestFinalDeliveries",
        "request-1",
      ],
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [
        "listingRequestAgreements",
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

  it("creates a private final-delivery draft", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          id: "final-delivery-1",
          listing_request_id: "request-1",
          agreement_id: "agreement-1",
          status: "draft",
          version_number: 1,
          submitted_at: null,
        },
      ],
      error: null,
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useCreateListingRequestFinalDelivery(),
      {
        wrapper,
      }
    );

    await act(async () => {
      await result.current.mutateAsync({
        agreementId: "agreement-1",
        status: "draft",
        title: "Final overlay delivery",
        summary:
          "The completed overlay package is being prepared.",
        deliveryLinks: [],
      });
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "create_listing_request_final_delivery",
      expect.objectContaining({
        p_status: "draft",
        p_delivery_links: [],
      })
    );
  });

  it("throws when the creator is signed out", async () => {
    mocks.useAuth.mockReturnValue({
      user: null,
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useCreateListingRequestFinalDelivery(),
      {
        wrapper,
      }
    );

    await expect(
      result.current.mutateAsync({
        agreementId: "agreement-1",
        status: "draft",
        title: "Final overlay delivery",
        summary:
          "The completed overlay package is being prepared.",
        deliveryLinks: [],
      })
    ).rejects.toThrow(
      "You must be signed in to create a final delivery."
    );

    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("surfaces RPC errors", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: new Error(
        "The project has an unresolved hold that must be completed before final delivery."
      ),
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useCreateListingRequestFinalDelivery(),
      {
        wrapper,
      }
    );

    await expect(
      result.current.mutateAsync({
        agreementId: "agreement-1",
        status: "submitted",
        title: "Final overlay delivery",
        summary:
          "The completed overlay package is ready for review.",
        deliveryLinks: [],
      })
    ).rejects.toThrow(
      "The project has an unresolved hold that must be completed before final delivery."
    );
  });

  it("throws when the RPC returns no delivery", async () => {
    mocks.rpc.mockResolvedValue({
      data: [],
      error: null,
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useCreateListingRequestFinalDelivery(),
      {
        wrapper,
      }
    );

    await expect(
      result.current.mutateAsync({
        agreementId: "agreement-1",
        status: "draft",
        title: "Final overlay delivery",
        summary:
          "The completed overlay package is being prepared.",
        deliveryLinks: [],
      })
    ).rejects.toThrow(
      "The final project delivery could not be created."
    );
  });
});