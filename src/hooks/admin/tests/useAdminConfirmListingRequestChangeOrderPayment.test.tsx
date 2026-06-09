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
  useAdminConfirmListingRequestChangeOrderPayment,
} from "../useAdminConfirmListingRequestChangeOrderPayment";

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
  "useAdminConfirmListingRequestChangeOrderPayment",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();

      mocks.rpc.mockResolvedValue({
        data: [
          {
            payment_schedule_item_id: "payment-2",
            listing_request_id: "request-1",
            agreement_id: "agreement-1",
            change_order_id: "change-order-1",
            payment_status: "paid",
            paid_at:
              "2026-06-08T12:00:00.000Z",
            hold_closed: true,
          },
        ],
        error: null,
      });
    });

    it(
      "confirms a change-order payment through the admin RPC",
      async () => {
        const { wrapper, invalidateSpy } =
          createWrapper();

        const { result } = renderHook(
          () =>
            useAdminConfirmListingRequestChangeOrderPayment(),
          {
            wrapper,
          }
        );

        await act(async () => {
          await result.current.mutateAsync({
            paymentScheduleItemId: "payment-2",
          });
        });

        expect(mocks.rpc).toHaveBeenCalledWith(
          "admin_confirm_listing_request_change_order_payment",
          {
            p_payment_schedule_item_id:
              "payment-2",
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
            "listingRequestChangeOrders",
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
            "Only an administrator can confirm a change-order payment.",
        },
      });

      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useAdminConfirmListingRequestChangeOrderPayment(),
        {
          wrapper,
        }
      );

      await expect(
        result.current.mutateAsync({
          paymentScheduleItemId: "payment-2",
        })
      ).rejects.toThrow(
        "Only an administrator can confirm a change-order payment."
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
            useAdminConfirmListingRequestChangeOrderPayment(),
          {
            wrapper,
          }
        );

        await expect(
          result.current.mutateAsync({
            paymentScheduleItemId: "payment-2",
          })
        ).rejects.toThrow(
          "The change-order payment could not be confirmed."
        );
      }
    );
  }
);