import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";
import type { ListingRequestSnapshot } from "../../lib/listings/listingRequestSnapshot";
import type { ListingRequestStatus } from "../../domain/listings/listingRequests";

export type BuyerListingRequestRow = {
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

export type BuyerListingRequestProfile = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type BuyerListingRequestItem = {
  request: BuyerListingRequestRow;
  creator: BuyerListingRequestProfile | null;
};

const emptyResult: BuyerListingRequestItem[] = [];

// Loads requests submitted by the signed-in buyer and joins creator profile data
const fetchMyBuyerRequests = async (
  userId: string
): Promise<BuyerListingRequestItem[]> => {
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
    .eq("buyer_user_id", userId)
    .order("created_at", { ascending: false });

  if (requestsError) {
    throw requestsError;
  }

  const requestRows = (requests ?? []) as BuyerListingRequestRow[];
  if (requestRows.length === 0) {
    return emptyResult;
  }

  const creatorIds = Array.from(
    new Set(requestRows.map((request) => request.creator_user_id))
  );

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id, handle, display_name, avatar_url")
    .in("user_id", creatorIds);

  if (profilesError) {
    throw profilesError;
  }

  const profileByUserId = Object.fromEntries(
    ((profiles ?? []) as BuyerListingRequestProfile[]).map((profile) => [
      profile.user_id,
      profile,
    ])
  ) as Record<string, BuyerListingRequestProfile>;

  return requestRows.map((request) => ({
    request,
    creator: profileByUserId[request.creator_user_id] ?? null,
  }));
};

export const useMyBuyerRequests = () => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<BuyerListingRequestItem[]>({
    queryKey: ["myBuyerRequests", userId],
    enabled: !loading && Boolean(userId),
    queryFn: () =>
      userId ? fetchMyBuyerRequests(userId) : Promise.resolve(emptyResult),
    staleTime: 15_000,
  });
};