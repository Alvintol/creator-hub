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
  useSendDraftListingRequestFinalDelivery,
} from "../useSendDraftListingRequestFinalDelivery";

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

describe(
  "useSendDraftListingRequestFinalDelivery",
  () => {
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

    it(
      "submits a final-delivery draft through the RPC",
      async () => {
        const { wrapper, invalidateSpy } =
          createWrapper();

        const { result } = renderHook(
          () =>
            useSendDraftListingRequestFinalDelivery(),
          {
            wrapper,
          }
        );

        await act(async () => {
          await result.current.mutateAsync({
            finalDeliveryId:
              "final-delivery-1",
          });
        });

        expect(mocks.rpc).toHaveBeenCalledWith(
          "send_draft_listing_request_final_delivery",
          {
            p_final_delivery_id:
              "final-delivery-1",
          }
        );

        expect(
          invalidateSpy
        ).toHaveBeenCalledWith({
          queryKey: [
            "listingRequestFinalDeliveries",
            "request-1",
          ],
        });

        expect(
          invalidateSpy
        ).toHaveBeenCalledWith({
          queryKey: [
            "listingRequestAgreements",
            "request-1",
          ],
        });

        expect(
          invalidateSpy
        ).toHaveBeenCalledWith({
          queryKey: [
            "creatorRequest",
            "request-1",
          ],
        });

        expect(
          invalidateSpy
        ).toHaveBeenCalledWith({
          queryKey: [
            "buyerRequest",
            "request-1",
          ],
        });

        expect(
          invalidateSpy
        ).toHaveBeenCalledWith({
          queryKey: [
            "adminRequest",
            "request-1",
          ],
        });

        expect(
          invalidateSpy
        ).toHaveBeenCalledWith({
          queryKey: ["conversationMessages"],
        });
      }
    );

    it("throws while signed out", async () => {
      mocks.useAuth.mockReturnValue({
        user: null,
      });

      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useSendDraftListingRequestFinalDelivery(),
        {
          wrapper,
        }
      );

      await expect(
        result.current.mutateAsync({
          finalDeliveryId:
            "final-delivery-1",
        })
      ).rejects.toThrow(
        "You must be signed in to submit this final delivery."
      );

      expect(mocks.rpc).not.toHaveBeenCalled();
    });

    it("surfaces RPC errors", async () => {
      mocks.rpc.mockResolvedValue({
        data: null,
        error: new Error(
          "This final-delivery draft is not available to submit."
        ),
      });

      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useSendDraftListingRequestFinalDelivery(),
        {
          wrapper,
        }
      );

      await expect(
        result.current.mutateAsync({
          finalDeliveryId:
            "final-delivery-1",
        })
      ).rejects.toThrow(
        "This final-delivery draft is not available to submit."
      );
    });

    it(
      "throws when the RPC returns no delivery",
      async () => {
        mocks.rpc.mockResolvedValue({
          data: [],
          error: null,
        });

        const { wrapper } = createWrapper();

        const { result } = renderHook(
          () =>
            useSendDraftListingRequestFinalDelivery(),
          {
            wrapper,
          }
        );

        await expect(
          result.current.mutateAsync({
            finalDeliveryId:
              "final-delivery-1",
          })
        ).rejects.toThrow(
          "The final project delivery could not be submitted."
        );
      }
    );
  }
);