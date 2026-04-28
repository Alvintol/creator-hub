import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";
import type { ListingRequestSnapshot } from "../../lib/listings/listingRequestSnapshot";
import type { ListingRequestStatus } from "../../domain/listings/listingRequests";

export type ListingRequestRow = {
  id: string;
  listing_id: string;
  buyer_user_id: string;
  creator_user_id: string;
  status: ListingRequestStatus;
  message: string;
  creator_status_reason: string | null;
  listing_snapshot: ListingRequestSnapshot;
  created_at: string;
  updated_at: string;
};

export type ListingRequestProfile = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type CreatorListingRequestItem = {
  request: ListingRequestRow;
  buyer: ListingRequestProfile | null;
};

const emptyResult: CreatorListingRequestItem[] = [];

// Loads requests for the signed-in creator and joins buyer profile display data
const fetchMyCreatorRequests = async (
  userId: string
): Promise<CreatorListingRequestItem[]> => {
  const { data: requests, error: requestsError } = await supabase
    .from("listing_requests")
    .select(`
      id,
      listing_id,
      buyer_user_id,
      creator_user_id,
      status,
      message,
      creator_status_reason,
      listing_snapshot,
      created_at,
      updated_at
    `)
    .eq("creator_user_id", userId)
    .order("created_at", { ascending: false });

  if (requestsError) {
    throw requestsError;
  }

  const requestRows = (requests ?? []) as ListingRequestRow[];
  if (requestRows.length === 0) {
    return emptyResult;
  }

  const buyerIds = Array.from(
    new Set(requestRows.map((request) => request.buyer_user_id))
  );

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id, handle, display_name, avatar_url")
    .in("user_id", buyerIds);

  if (profilesError) {
    throw profilesError;
  }

  const profileByUserId = Object.fromEntries(
    ((profiles ?? []) as ListingRequestProfile[]).map((profile) => [
      profile.user_id,
      profile,
    ])
  ) as Record<string, ListingRequestProfile>;

  return requestRows.map((request) => ({
    request,
    buyer: profileByUserId[request.buyer_user_id] ?? null,
  }));
};

export const useMyCreatorRequests = () => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<CreatorListingRequestItem[]>({
    queryKey: ["myCreatorRequests", userId],
    enabled: !loading && Boolean(userId),
    queryFn: () =>
      userId ? fetchMyCreatorRequests(userId) : Promise.resolve(emptyResult),
    staleTime: 15_000,
  });
};