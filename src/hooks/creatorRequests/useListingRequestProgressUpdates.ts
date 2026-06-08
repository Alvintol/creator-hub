import { useQuery } from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";
import type { ListingRequestProgressUpdateKind } from "./useCreateListingRequestProgressUpdate";

export type ListingRequestProgressUpdateRow = {
  id: string;
  listing_request_id: string;
  agreement_id: string;
  creator_user_id: string;
  update_kind: ListingRequestProgressUpdateKind;
  title: string;
  body: string;
  progress_percent: number | null;
  created_at: string;
  updated_at: string;
};

const fetchListingRequestProgressUpdates = async (
  listingRequestId: string
): Promise<ListingRequestProgressUpdateRow[]> => {
  const { data, error } = await supabase
    .from("listing_request_progress_updates")
    .select(
      `
        id,
        listing_request_id,
        agreement_id,
        creator_user_id,
        update_kind,
        title,
        body,
        progress_percent,
        created_at,
        updated_at
      `
    )
    .eq("listing_request_id", listingRequestId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as ListingRequestProgressUpdateRow[];
};

export const useListingRequestProgressUpdates = (
  listingRequestId?: string | null
) => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  return useQuery({
    queryKey: ["listingRequestProgressUpdates", listingRequestId],
    enabled: !loading && Boolean(userId && listingRequestId),
    queryFn: () =>
      listingRequestId
        ? fetchListingRequestProgressUpdates(listingRequestId)
        : Promise.resolve([]),
    staleTime: 15_000,
  });
};