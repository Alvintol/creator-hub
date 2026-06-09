import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";

type ConfirmFinalBalancePaymentInput = {
  paymentScheduleItemId: string;
};

type ConfirmedFinalBalancePaymentRow = {
  payment_schedule_item_id: string;
  listing_request_id: string;
  agreement_id: string;
  final_delivery_id: string;
  payment_status: "paid";
  paid_at: string;
  hold_closed: boolean;
};

const getErrorMessage = (error: unknown): string => {
  if (
    error &&
    typeof error === "object" &&
    "message" in error
  ) {
    return String(
      (error as { message?: unknown }).message
    );
  }

  return "The final-balance payment could not be confirmed.";
};

export const useAdminConfirmListingRequestFinalBalancePayment =
  () => {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (
        input: ConfirmFinalBalancePaymentInput
      ): Promise<ConfirmedFinalBalancePaymentRow> => {
        const { data, error } = await supabase.rpc(
          "admin_confirm_listing_request_final_balance_payment",
          {
            p_payment_schedule_item_id:
              input.paymentScheduleItemId,
          }
        );

        if (error) {
          throw new Error(getErrorMessage(error));
        }

        const result = Array.isArray(data)
          ? (data[0] as
              | ConfirmedFinalBalancePaymentRow
              | undefined)
          : undefined;

        if (
          !result?.payment_schedule_item_id ||
          !result.listing_request_id ||
          !result.agreement_id ||
          !result.final_delivery_id
        ) {
          throw new Error(
            "The final-balance payment could not be confirmed."
          );
        }

        return result;
      },

      onSuccess: async (result) => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: [
              "listingRequestAgreements",
              result.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "listingRequestFinalDeliveries",
              result.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "adminRequest",
              result.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "buyerRequest",
              result.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "creatorRequest",
              result.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: ["requestConversation"],
          }),

          queryClient.invalidateQueries({
            queryKey: ["conversationMessages"],
          }),

          queryClient.invalidateQueries({
            queryKey: ["messagesInbox"],
          }),
        ]);
      },
    });
  };