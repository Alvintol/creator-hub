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
  useAdminConfirmListingRequestFinalBalancePayment,
} from "../useAdminConfirmListingRequestFinalBalancePayment";

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
  "useAdminConfirmListingRequestFinalBalancePayment",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();

      mocks.rpc.mockResolvedValue({
        data: [
          {
            payment_schedule_item_id: "payment-3",
            listing_request_id: "request-1",
            agreement_id: "agreement-1",
            final_delivery_id: "final-delivery-1",
            payment_status: "paid",
            paid_at:
              "2026-06-09T12:00:00.000Z",
            hold_closed: true,
          },
        ],
        error: null,
      });
    });

    it(
      "confirms a final-balance payment through the admin RPC",
      async () => {
        const { wrapper, invalidateSpy } =
          createWrapper();

        const { result } = renderHook(
          () =>
            useAdminConfirmListingRequestFinalBalancePayment(),
          {
            wrapper,
          }
        );

        await act(async () => {
          await result.current.mutateAsync({
            paymentScheduleItemId: "payment-3",
          });
        });

        expect(mocks.rpc).toHaveBeenCalledWith(
          "admin_confirm_listing_request_final_balance_payment",
          {
            p_payment_schedule_item_id:
              "payment-3",
          }
        );

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
            "listingRequestFinalDeliveries",
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
          queryKey: [
            "buyerRequest",
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
          queryKey: ["conversationMessages"],
        });
      }
    );

    it("surfaces RPC errors", async () => {
      mocks.rpc.mockResolvedValue({
        data: null,
        error: {
          message:
            "Only an administrator can confirm a final-balance payment.",
        },
      });

      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useAdminConfirmListingRequestFinalBalancePayment(),
        {
          wrapper,
        }
      );

      await expect(
        result.current.mutateAsync({
          paymentScheduleItemId: "payment-3",
        })
      ).rejects.toThrow(
        "Only an administrator can confirm a final-balance payment."
      );
    });

    it(
      "throws when the RPC returns no confirmation row",
      async () => {
        mocks.rpc.mockResolvedValue({
          data: [],
          error: null,
        });

        const { wrapper } = createWrapper();

        const { result } = renderHook(
          () =>
            useAdminConfirmListingRequestFinalBalancePayment(),
          {
            wrapper,
          }
        );

        await expect(
          result.current.mutateAsync({
            paymentScheduleItemId: "payment-3",
          })
        ).rejects.toThrow(
          "The final-balance payment could not be confirmed."
        );
      }
    );
  }
);