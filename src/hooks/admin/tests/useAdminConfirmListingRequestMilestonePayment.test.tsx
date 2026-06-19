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

import { useAdminConfirmListingRequestMilestonePayment } from "../useAdminConfirmListingRequestMilestonePayment";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock(
  "../../../providers/AuthProvider",
  () => ({
    useAuth: mocks.useAuth,
  })
);

vi.mock(
  "../../../lib/supabaseClient",
  () => ({
    supabase: {
      rpc: mocks.rpc,
    },
  })
);

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
  "useAdminConfirmListingRequestMilestonePayment",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();

      mocks.useAuth.mockReturnValue({
        user: {
          id: "admin-1",
        },
      });

      mocks.rpc.mockResolvedValue({
        data: [
          {
            payment_schedule_item_id:
              "payment-1",
            milestone_id: "milestone-1",
            listing_request_id: "request-1",
            agreement_id: "agreement-1",
            payment_status: "paid",
            milestone_status: "paid",
            confirmed_at:
              "2026-06-18T12:00:00.000Z",
          },
        ],
        error: null,
      });
    });

    it("confirms a milestone payment through the admin RPC", async () => {
      const { wrapper, invalidateSpy } =
        createWrapper();

      const { result } = renderHook(
        () =>
          useAdminConfirmListingRequestMilestonePayment(),
        {
          wrapper,
        }
      );

      await act(async () => {
        await result.current.mutateAsync({
          paymentScheduleItemId:
            "payment-1",
        });
      });

      expect(mocks.rpc).toHaveBeenCalledWith(
        "admin_confirm_listing_request_milestone_payment",
        {
          p_payment_schedule_item_id:
            "payment-1",
        }
      );

      expect(
        invalidateSpy
      ).toHaveBeenCalledWith({
        queryKey: [
          "listingRequestMilestones",
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
          "adminRequest",
          "request-1",
        ],
      });

      expect(
        invalidateSpy
      ).toHaveBeenCalledWith({
        queryKey: ["conversationMessages"],
      });
    });

    it("throws while signed out", async () => {
      mocks.useAuth.mockReturnValue({
        user: null,
      });

      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useAdminConfirmListingRequestMilestonePayment(),
        {
          wrapper,
        }
      );

      await expect(
        result.current.mutateAsync({
          paymentScheduleItemId:
            "payment-1",
        })
      ).rejects.toThrow(
        "You must be signed in to confirm milestone payments."
      );

      expect(mocks.rpc).not.toHaveBeenCalled();
    });

    it("surfaces RPC errors", async () => {
      mocks.rpc.mockResolvedValue({
        data: null,
        error: new Error(
          "This milestone is not awaiting payment confirmation."
        ),
      });

      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useAdminConfirmListingRequestMilestonePayment(),
        {
          wrapper,
        }
      );

      await expect(
        result.current.mutateAsync({
          paymentScheduleItemId:
            "payment-1",
        })
      ).rejects.toThrow(
        "This milestone is not awaiting payment confirmation."
      );
    });

    it("throws when the RPC returns no response row", async () => {
      mocks.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useAdminConfirmListingRequestMilestonePayment(),
        {
          wrapper,
        }
      );

      await expect(
        result.current.mutateAsync({
          paymentScheduleItemId:
            "payment-1",
        })
      ).rejects.toThrow(
        "The milestone payment could not be confirmed."
      );
    });
  }
);