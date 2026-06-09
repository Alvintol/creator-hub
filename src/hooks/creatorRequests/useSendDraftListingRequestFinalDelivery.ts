import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

type SendDraftListingRequestFinalDeliveryInput = {
  finalDeliveryId: string;
};

type SubmittedFinalDeliveryRow = {
  id: string;
  listing_request_id: string;
  agreement_id: string;
  status: "submitted";
  version_number: number;
  submitted_at: string;
};

export const useSendDraftListingRequestFinalDelivery =
  () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
      mutationFn: async (
        input: SendDraftListingRequestFinalDeliveryInput
      ): Promise<SubmittedFinalDeliveryRow> => {
        if (!user?.id) {
          throw new Error(
            "You must be signed in to submit this final delivery."
          );
        }

        const { data, error } = await supabase.rpc(
          "send_draft_listing_request_final_delivery",
          {
            p_final_delivery_id:
              input.finalDeliveryId,
          }
        );

        if (error) {
          throw error;
        }

        const finalDelivery = Array.isArray(data)
          ? (data[0] as
              | SubmittedFinalDeliveryRow
              | undefined)
          : undefined;

        if (!finalDelivery?.id) {
          throw new Error(
            "The final project delivery could not be submitted."
          );
        }

        return finalDelivery;
      },

      onSuccess: async (finalDelivery) => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: [
              "listingRequestFinalDeliveries",
              finalDelivery.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "listingRequestAgreements",
              finalDelivery.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "creatorRequest",
              finalDelivery.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "buyerRequest",
              finalDelivery.listing_request_id,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "adminRequest",
              finalDelivery.listing_request_id,
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