import { useMutation, useQueryClient } from "@tanstack/react-query";

import type {
  ListingRequestAgreementStatus,
  ListingRequestStartingPaymentStatus,
} from "../../domain/listings/listingRequestAgreements";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

type RespondListingRequestAgreementInput = {
  agreementId: string;
  response: Extract<
    ListingRequestAgreementStatus,
    "buyer_accepted" | "buyer_declined"
  >;
  acknowledgementKeys?: string[];
};

type RespondedAgreementRow = {
  id: string;
  status: ListingRequestAgreementStatus;
  starting_payment_status: ListingRequestStartingPaymentStatus;
};

export const useRespondListingRequestAgreement = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: RespondListingRequestAgreementInput) => {
      if (!user?.id) {
        throw new Error("You must be signed in to respond to this agreement.");
      }

      const { data, error } = await supabase.rpc(
        "respond_listing_request_agreement",
        {
          p_agreement_id: input.agreementId,
          p_response: input.response,
          p_acknowledgement_keys: input.acknowledgementKeys ?? [],
        }
      );

      if (error) {
        throw error;
      }

      const agreement = Array.isArray(data)
        ? (data[0] as RespondedAgreementRow | undefined)
        : undefined;

      if (!agreement?.id) {
        throw new Error("The project agreement response could not be saved.");
      }

      return agreement;
    },

    onSuccess: async () => {
      // Refresh all request/agreement/message surfaces that can show agreement state.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["listingRequestAgreements"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["buyerRequest"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["creatorRequest"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["myBuyerRequests"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["myCreatorRequests"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["adminRequests"],
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