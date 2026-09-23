import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

export type ListingRequestCancellationStatementItemInput = {
  paymentId: string;
  milestoneId?: string | null;
  label: string;
  earnedAmountCents: number;
  note?: string | null;
};

type ProposeListingRequestCancellationInput = {
  requestId: string;
  reason: string;
  // Only the creator may include items -- the buyer opens a cancellation
  // with a reason only, and the creator submits the itemised statement
  // separately via useSubmitListingRequestCancellationStatement.
  items?: ListingRequestCancellationStatementItemInput[];
};

type ProposeListingRequestCancellationResult = {
  proposal_id: string;
  status: string;
  statement_due_at: string;
};

const toItemsPayload = (
  items: ListingRequestCancellationStatementItemInput[] | undefined
) =>
  items
    ? items.map((item) => ({
        payment_id: item.paymentId,
        milestone_id: item.milestoneId ?? null,
        label: item.label,
        earned_amount_cents: item.earnedAmountCents,
        note: item.note ?? null,
      }))
    : null;

export const useProposeListingRequestCancellation = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      requestId,
      reason,
      items,
    }: ProposeListingRequestCancellationInput) => {
      if (!user?.id) {
        throw new Error("You must be signed in to propose a cancellation.");
      }

      const { data, error } = await supabase.rpc(
        "propose_listing_request_cancellation",
        {
          p_request_id: requestId,
          p_reason: reason,
          p_items: toItemsPayload(items),
        }
      );

      if (error) {
        throw new Error(
          error.message || "The cancellation could not be proposed."
        );
      }

      const result = (
        Array.isArray(data) ? data[0] : null
      ) as ProposeListingRequestCancellationResult | null;

      if (!result?.proposal_id) {
        throw new Error("The cancellation could not be proposed.");
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
