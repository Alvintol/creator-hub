import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ListingRequestAgreementStatus } from "../../domain/listings/listingRequestAgreements";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

type SendDraftListingRequestAgreementInput = {
  agreementId: string;
};

type SentDraftAgreementRow = {
  id: string;
  status: ListingRequestAgreementStatus;
  sent_at: string | null;
};

export const useSendDraftListingRequestAgreement = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: SendDraftListingRequestAgreementInput) => {
      if (!user?.id) {
        throw new Error("You must be signed in to send this project agreement.");
      }

      const { data, error } = await supabase.rpc(
        "send_draft_listing_request_agreement",
        {
          p_agreement_id: input.agreementId,
        }
      );

      if (error) {
        throw error;
      }

      const agreement = Array.isArray(data)
        ? (data[0] as SentDraftAgreementRow | undefined)
        : undefined;

      if (!agreement?.id) {
        throw new Error("The project agreement could not be sent.");
      }

      return agreement;
    },

    onSuccess: async () => {
      // Refresh every surface that can show agreement/request/message state.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["listingRequestAgreements"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["creatorRequest"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["buyerRequest"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["myCreatorRequests"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["myBuyerRequests"],
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