import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ListingRequestStartingPaymentStatus } from "../../domain/listings/listingRequestAgreements";
import { supabase } from "../../lib/supabaseClient";

type ConfirmStartingPaymentInput = {
  agreementId: string;
};

type ConfirmedStartingPaymentRow = {
  agreement_id: string;
  listing_request_id: string;
  starting_payment_status: ListingRequestStartingPaymentStatus;
  paid_at: string;
};

const getErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message);
  }

  return "The starting payment could not be confirmed.";
};

export const useAdminConfirmListingRequestStartingPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: ConfirmStartingPaymentInput
    ): Promise<ConfirmedStartingPaymentRow> => {
      const { data, error } = await supabase.rpc(
        "admin_confirm_listing_request_starting_payment",
        {
          p_agreement_id: input.agreementId,
        }
      );

      if (error) {
        throw new Error(getErrorMessage(error));
      }

      const result = Array.isArray(data)
        ? (data[0] as ConfirmedStartingPaymentRow | undefined)
        : undefined;

      if (!result?.agreement_id || !result.listing_request_id) {
        throw new Error("The starting payment could not be confirmed.");
      }

      return result;
    },

    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["listingRequestAgreements"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["adminRequest", result.listing_request_id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["buyerRequest", result.listing_request_id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["creatorRequest", result.listing_request_id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["adminRequests"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["myBuyerRequests"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["myCreatorRequests"],
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