import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";
import { expireCancelledCheckoutSessions } from "../payments/expireCancelledCheckoutSessions";
import { useAuth } from "../../providers/AuthProvider";

export type RespondListingRequestCancellationProposalInput =
  | {
      proposalId: string;
      requestId: string;
      response: "accepted";
    }
  | {
      proposalId: string;
      requestId: string;
      response: "disputed";
      disputeReason: string;
    };

type RespondListingRequestCancellationProposalResult = {
  proposal_id: string;
  status: string;
  request_status: string;
  payments_to_expire: string[];
};

export const useRespondListingRequestCancellationProposal = () => {
  const queryClient = useQueryClient();
  const { session, user } = useAuth();

  return useMutation({
    mutationFn: async (
      input: RespondListingRequestCancellationProposalInput
    ) => {
      if (!user?.id) {
        throw new Error(
          "You must be signed in to respond to a cancellation proposal."
        );
      }

      const { data, error } = await supabase.rpc(
        "respond_listing_request_cancellation_proposal",
        {
          p_proposal_id: input.proposalId,
          p_response: input.response,
          p_response_reason:
            input.response === "disputed" ? input.disputeReason : null,
        }
      );

      if (error) {
        throw new Error(
          error.message || "The cancellation response could not be saved."
        );
      }

      const result = (
        Array.isArray(data) ? data[0] : null
      ) as RespondListingRequestCancellationProposalResult | null;

      if (!result?.proposal_id) {
        throw new Error("The cancellation response could not be saved.");
      }

      if (result.payments_to_expire?.length) {
        await expireCancelledCheckoutSessions({
          listingRequestId: input.requestId,
          accessToken: session?.access_token,
        });
      }

      return result;
    },

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["listingRequestCancellationProposal"],
        }),
        queryClient.invalidateQueries({ queryKey: ["buyerRequest"] }),
        queryClient.invalidateQueries({ queryKey: ["creatorRequest"] }),
        queryClient.invalidateQueries({ queryKey: ["adminRequests"] }),
        queryClient.invalidateQueries({
          queryKey: ["listingRequestAgreements"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["listingRequestPayments"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["listingRequestMilestones"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["listingRequestChangeOrders"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["listingRequestFinalDeliveries"],
        }),
        queryClient.invalidateQueries({ queryKey: ["requestConversation"] }),
        queryClient.invalidateQueries({ queryKey: ["conversationMessages"] }),
        queryClient.invalidateQueries({ queryKey: ["messagesInbox"] }),
      ]);
    },
  });
};
