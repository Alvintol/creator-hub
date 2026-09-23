import { useQuery } from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

export type ListingRequestCancellationProposalStatus =
  | "pending_creator_statement"
  | "pending_buyer_response"
  | "accepted"
  | "disputed";

export type ListingRequestCancellationProposalItemRow = {
  id: string;
  proposal_id: string;
  payment_id: string;
  milestone_id: string | null;
  authored_by_user_id: string;
  is_operative: boolean;
  label: string;
  paid_amount_cents: number;
  earned_amount_cents: number;
  unearned_amount_cents: number;
  note: string | null;
  flagged_for_refund_at: string | null;
  refunded_at: string | null;
  created_at: string;
};

export type ListingRequestCancellationProposalRow = {
  id: string;
  listing_request_id: string;
  agreement_id: string;
  creator_user_id: string;
  buyer_user_id: string;
  proposed_by_user_id: string;
  status: ListingRequestCancellationProposalStatus;
  reason: string;
  statement_due_at: string;
  statement_submitted_at: string | null;
  statement_submitted_by_user_id: string | null;
  buyer_response: "accepted" | "disputed" | null;
  buyer_response_reason: string | null;
  responded_at: string | null;
  accepted_at: string | null;
  disputed_at: string | null;
  created_at: string;
  updated_at: string;
  listing_request_cancellation_proposal_items: ListingRequestCancellationProposalItemRow[];
};

// The most recent cancellation proposal for a request, open or resolved --
// the workspace only treats it as active when status is one of the two
// pending states (see requestWorkspace.ts's cancellationProposal input).
export const useListingRequestCancellationProposal = (
  listingRequestId?: string | null
) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["listingRequestCancellationProposal", listingRequestId],
    enabled: Boolean(user?.id && listingRequestId),

    queryFn: async (): Promise<ListingRequestCancellationProposalRow | null> => {
      if (!user?.id || !listingRequestId) {
        return null;
      }

      const { data, error } = await supabase
        .from("listing_request_cancellation_proposals")
        .select(
          `
            id,
            listing_request_id,
            agreement_id,
            creator_user_id,
            buyer_user_id,
            proposed_by_user_id,
            status,
            reason,
            statement_due_at,
            statement_submitted_at,
            statement_submitted_by_user_id,
            buyer_response,
            buyer_response_reason,
            responded_at,
            accepted_at,
            disputed_at,
            created_at,
            updated_at,
            listing_request_cancellation_proposal_items (
              id,
              proposal_id,
              payment_id,
              milestone_id,
              authored_by_user_id,
              is_operative,
              label,
              paid_amount_cents,
              earned_amount_cents,
              unearned_amount_cents,
              note,
              flagged_for_refund_at,
              refunded_at,
              created_at
            )
          `
        )
        .eq("listing_request_id", listingRequestId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return (
        (data as ListingRequestCancellationProposalRow | null) ?? null
      );
    },
  });
};
