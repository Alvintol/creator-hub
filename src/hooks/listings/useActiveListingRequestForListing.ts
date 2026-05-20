import { useQuery } from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

type ActiveListingRequestStatus = "submitted" | "accepted";

export type ActiveListingRequestForListing = {
  id: string;
  listing_id: string;
  buyer_user_id: string;
  status: ActiveListingRequestStatus;
  created_at: string;
  updated_at: string;
};

export const useActiveListingRequestForListing = (listingId?: string | null) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["activeListingRequestForListing", user?.id ?? null, listingId],
    enabled: Boolean(user?.id && listingId),
    queryFn: async () => {
      if (!user?.id || !listingId) {
        return null;
      }

      const { data, error } = await supabase
        .from("listing_requests")
        .select(
          `
          id,
          listing_id,
          buyer_user_id,
          status,
          created_at,
          updated_at
        `
        )
        .eq("listing_id", listingId)
        .eq("buyer_user_id", user.id)
        .in("status", ["submitted", "accepted"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data as ActiveListingRequestForListing | null;
    },
  });
};