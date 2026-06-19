import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

export type AdminConfirmListingRequestMilestonePaymentInput =
  {
    paymentScheduleItemId: string;
  };

export type AdminConfirmedListingRequestMilestonePaymentRow =
  {
    payment_schedule_item_id: string;
    milestone_id: string;
    listing_request_id: string;
    agreement_id: string;
    payment_status: "paid";
    milestone_status: "paid";
    confirmed_at: string;
  };

const getErrorMessage = (
  error: unknown
): string => {
  if (
    error &&
    typeof error === "object" &&
    "message" in error
  ) {
    return String(
      (error as { message?: unknown }).message
    );
  }

  return "The milestone payment could not be confirmed.";
};

export const useAdminConfirmListingRequestMilestonePayment =
  () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
      mutationFn: async ({
        paymentScheduleItemId,
      }: AdminConfirmListingRequestMilestonePaymentInput): Promise<AdminConfirmedListingRequestMilestonePaymentRow> => {
        if (!user?.id) {
          throw new Error(
            "You must be signed in to confirm milestone payments."
          );
        }

        const { data, error } = await supabase.rpc(
          "admin_confirm_listing_request_milestone_payment",
          {
            p_payment_schedule_item_id:
              paymentScheduleItemId,
          }
        );

        if (error) {
          throw new Error(getErrorMessage(error));
        }

        const responseRow = Array.isArray(data)
          ? (data[0] as
              | AdminConfirmedListingRequestMilestonePaymentRow
              | undefined)
          : undefined;

        if (
          !responseRow?.payment_schedule_item_id ||
          !responseRow.milestone_id ||
          !responseRow.listing_request_id ||
          !responseRow.agreement_id
        ) {
          throw new Error(
            "The milestone payment could not be confirmed."
          );
        }

        return responseRow;
      },

      onSuccess: async (responseRow) => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: [
              "listingRequestMilestones",
              responseRow.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "listingRequestMilestoneSubmissions",
              responseRow.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "listingRequestAgreements",
              responseRow.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "buyerRequest",
              responseRow.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "creatorRequest",
              responseRow.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "adminRequest",
              responseRow.listing_request_id,
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