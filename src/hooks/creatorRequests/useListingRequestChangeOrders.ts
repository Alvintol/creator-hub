import { useQuery } from "@tanstack/react-query";

import type { ListingRequestChangeOrderStatus } from "../../domain/listings/listingRequestAgreements";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

export type ListingRequestChangeOrderSnapshot = Record<string, unknown>;

export type ListingRequestChangeOrderRow = {
  id: string;
  listing_request_id: string;
  agreement_id: string;
  creator_user_id: string;
  buyer_user_id: string;
  version_number: number;
  status: ListingRequestChangeOrderStatus;
  title: string;
  summary: string;
  changes_scope: boolean;
  changes_price: boolean;
  changes_timeline: boolean;
  changes_deliverables: boolean;
  changes_payment_schedule: boolean;
  changes_milestones: boolean;
  price_delta: number;
  revised_total_amount: number | null;
  timeline_delta_days: number;
  revised_completion_at: string | null;
  before_snapshot: ListingRequestChangeOrderSnapshot;
  proposed_snapshot: ListingRequestChangeOrderSnapshot;
  buyer_response_reason: string | null;
  sent_at: string | null;
  buyer_accepted_at: string | null;
  buyer_declined_at: string | null;
  cancelled_at: string | null;
  superseded_at: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
};

export const useListingRequestChangeOrders = (
  listingRequestId?: string | null
) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["listingRequestChangeOrders", listingRequestId],
    enabled: Boolean(user?.id && listingRequestId),

    queryFn: async (): Promise<ListingRequestChangeOrderRow[]> => {
      if (!user?.id || !listingRequestId) {
        return [];
      }

      const { data, error } = await supabase
        .from("listing_request_change_orders")
        .select(
          `
            id,
            listing_request_id,
            agreement_id,
            creator_user_id,
            buyer_user_id,
            version_number,
            status,
            title,
            summary,
            changes_scope,
            changes_price,
            changes_timeline,
            changes_deliverables,
            changes_payment_schedule,
            changes_milestones,
            price_delta,
            revised_total_amount,
            timeline_delta_days,
            revised_completion_at,
            before_snapshot,
            proposed_snapshot,
            buyer_response_reason,
            sent_at,
            buyer_accepted_at,
            buyer_declined_at,
            cancelled_at,
            superseded_at,
            applied_at,
            created_at,
            updated_at
          `
        )
        .eq("listing_request_id", listingRequestId)
        .order("version_number", { ascending: false });

      if (error) {
        throw error;
      }

      return (data as ListingRequestChangeOrderRow[] | null) ?? [];
    },
  });
};