import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";
import type { ListingRequestCancellationStatementItemInput } from "./useProposeListingRequestCancellation";

type SubmitListingRequestCancellationStatementInput = {
  proposalId: string;
  items: ListingRequestCancellationStatementItemInput[];
};

type SubmitListingRequestCancellationStatementResult = {
  proposal_id: string;
  status: string;
  statement_submitted_at: string;
};

export const useSubmitListingRequestCancellationStatement = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      proposalId,
      items,
    }: SubmitListingRequestCancellationStatementInput) => {
      if (!user?.id) {
        throw new Error(
          "You must be signed in to submit a cancellation statement."
        );
      }

      const { data, error } = await supabase.rpc(
        "submit_listing_request_cancellation_statement",
        {
          p_proposal_id: proposalId,
          p_items: items.map((item) => ({
            payment_id: item.paymentId,
            milestone_id: item.milestoneId ?? null,
            label: item.label,
            earned_amount_cents: item.earnedAmountCents,
            note: item.note ?? null,
          })),
        }
      );

      if (error) {
        throw new Error(
          error.message || "The cancellation statement could not be submitted."
        );
      }

      const result = (
        Array.isArray(data) ? data[0] : null
      ) as SubmitListingRequestCancellationStatementResult | null;

      if (!result?.proposal_id) {
        throw new Error("The cancellation statement could not be submitted.");
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
        queryClient.invalidateQueries({ queryKey: ["requestConversation"] }),
        queryClient.invalidateQueries({ queryKey: ["conversationMessages"] }),
        queryClient.invalidateQueries({ queryKey: ["messagesInbox"] }),
      ]);
    },
  });
};
