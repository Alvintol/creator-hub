import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";

export type ListingRequestEarlyReviewCategory =
  | "missed_essential_deadline"
  | "credible_fraud"
  | "creator_cannot_complete";

// Sprint 6 (launch-scope.md section 7, "Early review" row): either party
// can skip the 7+7 day wait for a missed essential deadline, credible
// fraud, or the creator saying they cannot complete -- but only by asking
// an admin to approve it (flag_listing_request_for_early_review), not by
// closing anything directly. See
// admin_close_listing_request_for_non_response
// (20260922_133) for what an approved flag then unlocks.
export const useFlagListingRequestForEarlyReview = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      category,
      note,
    }: {
      requestId: string;
      category: ListingRequestEarlyReviewCategory;
      note: string;
    }) => {
      const { data, error } = await supabase.rpc(
        "flag_listing_request_for_early_review",
        { p_request_id: requestId, p_category: category, p_note: note }
      );

      if (error) {
        throw new Error(
          error.message || "The early review request could not be sent."
        );
      }

      return data;
    },

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["listingRequestEarlyReviewFlags"],
        }),
        queryClient.invalidateQueries({ queryKey: ["requestConversation"] }),
        queryClient.invalidateQueries({ queryKey: ["conversationMessages"] }),
      ]);
    },
  });
};
