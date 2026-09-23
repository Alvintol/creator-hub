import { useQuery } from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";
import type { ListingRequestEarlyReviewCategory } from "./useFlagListingRequestForEarlyReview";

export type ListingRequestEarlyReviewFlag = {
  id: string;
  flagged_by_user_id: string;
  category: ListingRequestEarlyReviewCategory;
  note: string;
  status: "pending" | "approved" | "declined";
  reviewed_by_admin_user_id: string | null;
  reviewed_at: string | null;
  decision_note: string | null;
  created_at: string;
};

const fetchFlags = async (
  requestId: string
): Promise<ListingRequestEarlyReviewFlag[]> => {
  const { data, error } = await supabase
    .from("listing_request_early_review_flags")
    .select(
      "id, flagged_by_user_id, category, note, status, reviewed_by_admin_user_id, reviewed_at, decision_note, created_at"
    )
    .eq("listing_request_id", requestId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as ListingRequestEarlyReviewFlag[];
};

export const useListingRequestEarlyReviewFlags = (requestId: string | null) =>
  useQuery<ListingRequestEarlyReviewFlag[]>({
    queryKey: ["listingRequestEarlyReviewFlags", requestId],
    enabled: Boolean(requestId),
    queryFn: () => (requestId ? fetchFlags(requestId) : Promise.resolve([])),
    staleTime: 15_000,
  });
