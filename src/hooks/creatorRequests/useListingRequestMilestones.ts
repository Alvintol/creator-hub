import { useQuery } from "@tanstack/react-query";

import type {
  ListingRequestMilestoneStatus,
} from "../../domain/listings/listingRequestMilestones";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

export type ListingRequestMilestoneRow = {
  id: string;
  listing_request_id: string;
  agreement_id: string;
  agreement_item_id: string;
  payment_schedule_item_id: string;
  creator_user_id: string;
  buyer_user_id: string;
  status: ListingRequestMilestoneStatus;
  title: string;
  description: string | null;
  amount: number;
  currency: string;
  sort_order: number;
  submission_version: number;
  latest_submitted_at: string | null;
  latest_revision_requested_at: string | null;
  buyer_approved_at: string | null;
  payment_required_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export const useListingRequestMilestones = (
  listingRequestId?: string | null
) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: [
      "listingRequestMilestones",
      listingRequestId,
    ],

    enabled: Boolean(
      user?.id &&
      listingRequestId
    ),

    queryFn: async (): Promise<
      ListingRequestMilestoneRow[]
    > => {
      if (!user?.id || !listingRequestId) {
        return [];
      }

      const { data, error } = await supabase
        .from("listing_request_milestones")
        .select(`
          id,
          listing_request_id,
          agreement_id,
          agreement_item_id,
          payment_schedule_item_id,
          creator_user_id,
          buyer_user_id,
          status,
          title,
          description,
          amount,
          currency,
          sort_order,
          submission_version,
          latest_submitted_at,
          latest_revision_requested_at,
          buyer_approved_at,
          payment_required_at,
          paid_at,
          cancelled_at,
          created_at,
          updated_at
        `)
        .eq(
          "listing_request_id",
          listingRequestId
        )
        .order("sort_order", {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      return (
        data as
          | ListingRequestMilestoneRow[]
          | null
      ) ?? [];
    },
  });
};