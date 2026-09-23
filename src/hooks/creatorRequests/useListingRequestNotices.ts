import { useQuery } from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";
import type { ListingRequestNotice } from "../../domain/listings/listingRequestNotices";

const fetchListingRequestNotices = async (
  requestId: string
): Promise<ListingRequestNotice[]> => {
  const { data, error } = await supabase
    .from("listing_request_notices")
    .select(
      "id, notice_type, sender_user_id, recipient_user_id, requested_action, sent_at, expires_at, answered_at, email_status"
    )
    .eq("listing_request_id", requestId)
    .order("sent_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as ListingRequestNotice[];
};

// Sprint 6 (launch-scope.md section 7): notice history for the workspace UI
// -- RLS (20260922_131) already restricts this to the request's
// participants and admins, so no extra filtering is needed here.
export const useListingRequestNotices = (requestId: string | null) =>
  useQuery<ListingRequestNotice[]>({
    queryKey: ["listingRequestNotices", requestId],
    enabled: Boolean(requestId),
    queryFn: () =>
      requestId ? fetchListingRequestNotices(requestId) : Promise.resolve([]),
    staleTime: 15_000,
  });
