import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";

// Sprint 6 (launch-scope.md section 7): admin approval is the gate an
// early-review flag has to pass before
// admin_close_listing_request_for_non_response will accept it as a
// substitute for the 7+7 day wait -- see 20260922_132's comment on why this
// is a separate entry point rather than a bypass flag inside the closure
// RPC itself.
export const useAdminDecideListingRequestEarlyReview = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      flagId,
      decision,
      decisionNote,
    }: {
      flagId: string;
      decision: "approved" | "declined";
      decisionNote?: string | null;
    }) => {
      const { data, error } = await supabase.rpc(
        "admin_decide_listing_request_early_review",
        {
          p_flag_id: flagId,
          p_decision: decision,
          p_decision_note: decisionNote ?? null,
        }
      );

      if (error) {
        throw new Error(error.message || "This decision could not be recorded.");
      }

      return data;
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["listingRequestEarlyReviewFlags"],
      });
    },
  });
};
